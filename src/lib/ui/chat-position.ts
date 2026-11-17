import { branding } from '#lib/generated/branding.ts';

/**
 * La position de lecture est une petite préférence d'appareil, pas une donnée
 * de ligue : elle vit dans le stockage local, porte l'identifiant du membre
 * pour qu'un appareil partagé ne rende jamais la place d'un autre, et reste
 * best-effort si le navigateur refuse le stockage.
 */
export type ChatPosition = {
	messageId: string;
	/** Position du haut du message par rapport au haut de la fenêtre. */
	offset: number;
	savedAt: number;
};

type ChatStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const MESSAGE_ID_MAX = 200;
const OFFSET_MAX = 100_000;

/**
 * Un effacement à la déconnexion ferme la position du membre : le `pagehide`
 * qui suit la soumission ne doit pas réécrire la place de lecture après le
 * nettoyage. Le document est rechargé par la déconnexion, donc le drapeau ne
 * survit pas à la session suivante.
 */
const closedUsers = new Set<string>();

export function chatPositionKey(userId: string): string {
	return `${branding.cachePrefix}-chat-position:${userId}`;
}

function storageOrNull(storage?: ChatStorage): ChatStorage | null {
	if (storage) return storage;
	try {
		// Un stockage bloqué peut lever dès l'accès à la propriété, pas
		// seulement à la lecture : la position reste alors absente, jamais une
		// panne de la page ou de la déconnexion.
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

export function parseChatPosition(raw: string | null): ChatPosition | null {
	if (!raw) return null;
	try {
		const value = JSON.parse(raw) as Partial<ChatPosition>;
		if (
			typeof value.messageId !== 'string' ||
			value.messageId.length === 0 ||
			value.messageId.length > MESSAGE_ID_MAX ||
			typeof value.offset !== 'number' ||
			!Number.isFinite(value.offset) ||
			Math.abs(value.offset) > OFFSET_MAX ||
			typeof value.savedAt !== 'number' ||
			!Number.isSafeInteger(value.savedAt) ||
			value.savedAt <= 0
		) {
			return null;
		}
		return {
			messageId: value.messageId,
			offset: value.offset,
			savedAt: value.savedAt
		};
	} catch {
		return null;
	}
}

export function readChatPosition(
	userId: string,
	storage?: ChatStorage
): ChatPosition | null {
	const target = storageOrNull(storage);
	if (!target) return null;
	try {
		return parseChatPosition(target.getItem(chatPositionKey(userId)));
	} catch {
		return null;
	}
}

export function writeChatPosition(
	userId: string,
	position: ChatPosition,
	storage?: ChatStorage
): boolean {
	if (closedUsers.has(userId)) return false;
	const target = storageOrNull(storage);
	if (!target) return false;
	try {
		target.setItem(chatPositionKey(userId), JSON.stringify(position));
		return true;
	} catch {
		return false;
	}
}

export function clearChatPosition(userId: string, storage?: ChatStorage): void {
	closedUsers.add(userId);
	const target = storageOrNull(storage);
	if (!target) return;
	try {
		target.removeItem(chatPositionKey(userId));
	} catch {
		// La préférence est déjà absente ou le stockage est fermé.
	}
}
