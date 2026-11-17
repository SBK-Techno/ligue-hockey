import { CHAT_CACHE_MAX_MESSAGES } from '#config/chat.ts';
import type { ChatMessageView } from '#lib/domain/chat/service.ts';
import { branding } from '#lib/generated/branding.ts';
import { encodeCursor } from '#lib/shared/paging/cursor.ts';
import {
	cacheIsComplete,
	chatCacheSnapshot,
	compareChatMessages,
	plainChatMessage,
	type ChatCacheMeta,
	type ChatCacheSnapshot
} from './chat-cache.ts';

/** Ce que la page sait de la copie; les curseurs appartiennent au stockage. */
export type ChatCacheState = Pick<ChatCacheMeta, 'complete' | 'syncedAt'>;

/**
 * Le cache IndexedDB de la conversation. Une entrée appartient à un membre :
 * la clé porte son identifiant, et une lecture ne rend jamais les messages
 * d'un autre compte. Le cache est une copie de travail : une panne de stockage
 * laisse la conversation réseau intacte et ne remonte jamais comme une erreur
 * de lecture.
 */
const DB_NAME = `${branding.cachePrefix}-chat`;
const DB_VERSION = 1;
const MESSAGES = 'messages';
const META = 'meta';

type MessageRecord = {
	key: string;
	userId: string;
	id: string;
	createdAt: number;
	message: ChatMessageView;
};

type MetaRecord = ChatCacheMeta & { userId: string };

let database: Promise<IDBDatabase | null> | undefined;

/**
 * Une déconnexion ferme le cache du membre : une synchronisation déjà en vol
 * peut encore répondre après l'effacement, et ses écritures ne doivent jamais
 * ramener la conversation sur l'appareil. Le drapeau vit le temps du document;
 * la déconnexion recharge la page et la session suivante repart à zéro.
 */
const closedUsers = new Set<string>();

function hasIndexedDb(): boolean {
	return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase | null> {
	if (!hasIndexedDb()) return Promise.resolve(null);
	database ??= new Promise((resolve) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(MESSAGES)) {
				const store = db.createObjectStore(MESSAGES, { keyPath: 'key' });
				store.createIndex('byUser', 'userId');
				store.createIndex('byUserCreated', ['userId', 'createdAt', 'id']);
			}
			if (!db.objectStoreNames.contains(META)) {
				db.createObjectStore(META, { keyPath: 'userId' });
			}
		};
		request.onsuccess = () => {
			const db = request.result;
			db.onversionchange = () => db.close();
			resolve(db);
		};
		request.onerror = () => resolve(null);
		request.onblocked = () => resolve(null);
	});
	return database;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error);
	});
}

function messageKey(userId: string, messageId: string): string {
	return `${userId}\u0000${messageId}`;
}

function recordFor(userId: string, message: ChatMessageView): MessageRecord {
	return {
		key: messageKey(userId, message.id),
		userId,
		id: message.id,
		createdAt: message.createdAt,
		message: plainChatMessage(message)
	};
}

function userRange(userId: string): IDBKeyRange {
	return IDBKeyRange.bound(
		[userId, -1, ''],
		[userId, Number.MAX_SAFE_INTEGER, '\uffff']
	);
}

/**
 * Les deux extrémités réellement stockées. Après une éviction, le curseur le
 * plus ancien doit désigner un message présent, sinon la page suivante
 * sauterait les messages partis du cache.
 */
async function edgeRecords(
	db: IDBDatabase,
	userId: string
): Promise<{ oldest: MessageRecord | null; latest: MessageRecord | null }> {
	const transaction = db.transaction(MESSAGES, 'readonly');
	const index = transaction.objectStore(MESSAGES).index('byUserCreated');
	const range = userRange(userId);
	const oldestRequest = index.getAll(range, 1);
	const latestRequest = index.openCursor(range, 'prev');
	const [oldestRows, latest] = await Promise.all([
		requestResult(oldestRequest),
		new Promise<MessageRecord | null>((resolve, reject) => {
			latestRequest.onsuccess = () =>
				resolve((latestRequest.result?.value as MessageRecord | undefined) ?? null);
			latestRequest.onerror = () => reject(latestRequest.error);
		})
	]);
	return { oldest: (oldestRows[0] as MessageRecord | undefined) ?? null, latest };
}

export async function readChatCache(userId: string): Promise<ChatCacheSnapshot | null> {
	const db = await openDatabase();
	if (!db) return null;
	try {
		const transaction = db.transaction([MESSAGES, META], 'readonly');
		const recordsRequest = transaction
			.objectStore(MESSAGES)
			.index('byUser')
			.getAll(userId);
		const metaRequest = transaction.objectStore(META).get(userId);
		const [records, meta] = await Promise.all([
			requestResult(recordsRequest),
			requestResult(metaRequest)
		]);
		const messages = (records as MessageRecord[])
			.map((record) => record.message)
			.sort(compareChatMessages);
		if (messages.length === 0 && !meta) return null;
		if (meta) {
			const stored = meta as MetaRecord;
			return {
				messages,
				oldestCursor: stored.oldestCursor,
				latestCursor: stored.latestCursor,
				complete: stored.complete,
				syncedAt: stored.syncedAt
			};
		}
		return chatCacheSnapshot(messages, { complete: false, syncedAt: null });
	} catch {
		return null;
	}
}

/**
 * Le seul chemin d'écriture : les messages reçus (page, synchronisation,
 * historique) entrent, le plafond s'applique, puis les deux curseurs se lisent
 * dans les lignes réellement conservées. Une éviction invalide la complétude :
 * la copie ne couvre plus l'origine, et une relecture doit pouvoir remonter
 * par `before` au lieu de croire l'historique complet.
 */
export async function writeChatMessages(
	userId: string,
	messages: readonly ChatMessageView[],
	state: ChatCacheState
): Promise<ChatCacheMeta | null> {
	if (closedUsers.has(userId)) return null;
	const db = await openDatabase();
	if (!db || closedUsers.has(userId)) return null;
	try {
		if (messages.length > 0) {
			const transaction = db.transaction(MESSAGES, 'readwrite');
			const store = transaction.objectStore(MESSAGES);
			for (const message of messages) store.put(recordFor(userId, message));
			await transactionDone(transaction);
		}
		const evicted = await evictOldest(userId);
		const { oldest, latest } = await edgeRecords(db, userId);
		const meta: ChatCacheMeta = {
			oldestCursor: oldest ? encodeCursor({ createdAt: oldest.createdAt, id: oldest.id }) : null,
			latestCursor: latest ? encodeCursor({ createdAt: latest.createdAt, id: latest.id }) : null,
			complete: cacheIsComplete(state.complete, evicted),
			syncedAt: state.syncedAt
		};
		const transaction = db.transaction(META, 'readwrite');
		transaction.objectStore(META).put({ ...meta, userId });
		await transactionDone(transaction);
		return meta;
	} catch {
		return null;
	}
}

export async function clearChatCache(userId: string): Promise<boolean> {
	// D'abord fermer la porte : une réponse réseau en vol ne doit pas écrire
	// entre l'effacement et le déchargement de la page.
	closedUsers.add(userId);
	const db = await openDatabase();
	if (!db) return false;
	try {
		const transaction = db.transaction([MESSAGES, META], 'readwrite');
		const messages = transaction.objectStore(MESSAGES);
		const request = messages.index('byUser').openKeyCursor(IDBKeyRange.only(userId));
		request.onsuccess = () => {
			const cursor = request.result;
			if (!cursor) return;
			messages.delete(cursor.primaryKey);
			cursor.continue();
		};
		transaction.objectStore(META).delete(userId);
		await transactionDone(transaction);
		return true;
	} catch {
		return false;
	}
}

/**
 * Le plafond n'est pas une pagination : il protège le stockage d'une ligue
 * qui durerait des décennies. Les plus anciens messages partent d'abord; la
 * page peut les recharger par le curseur `before` si le membre remonte.
 */
async function evictOldest(userId: string): Promise<number> {
	const db = await openDatabase();
	if (!db) return 0;
	try {
		const countTransaction = db.transaction(MESSAGES, 'readonly');
		const count = await requestResult(
			countTransaction.objectStore(MESSAGES).index('byUser').count(userId)
		);
		if (count <= CHAT_CACHE_MAX_MESSAGES) return 0;
		let remaining = count - CHAT_CACHE_MAX_MESSAGES;
		const evicted = remaining;
		const transaction = db.transaction(MESSAGES, 'readwrite');
		const store = transaction.objectStore(MESSAGES);
		const request = store.index('byUserCreated').openKeyCursor(userRange(userId));
		request.onsuccess = () => {
			const cursor = request.result;
			if (!cursor || remaining <= 0) return;
			store.delete(cursor.primaryKey);
			remaining -= 1;
			cursor.continue();
		};
		await transactionDone(transaction);
		return evicted;
	} catch {
		// Le cache reste utilisable; le plafond sera retenté à la prochaine écriture.
		return 0;
	}
}
