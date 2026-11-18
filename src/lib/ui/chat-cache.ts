import type { ChatMessageView, ChatPollView } from '#lib/domain/chat/service.ts';
import { encodeCursor } from '#lib/shared/paging/cursor.ts';

/**
 * Le cache de conversation est une copie de travail, jamais une source de
 * vérité : le serveur reste l'autorité et chaque synchronisation remplace les
 * messages qu'elle reçoit. Ces fonctions sont pures pour que la fusion, la
 * déduplication et les curseurs se testent sans navigateur.
 */
export type ChatCacheMeta = {
	/** Curseur `before` du plus ancien message conservé. */
	oldestCursor: string | null;
	/** Curseur `after` du plus récent message conservé. */
	latestCursor: string | null;
	/** Vrai quand le serveur a confirmé qu'aucun message plus ancien ne reste. */
	complete: boolean;
	/** Heure serveur de la dernière synchronisation, pour rattraper les suppressions. */
	syncedAt: number | null;
};

export type ChatCacheSnapshot = ChatCacheMeta & { messages: ChatMessageView[] };

/**
 * Une copie profondément simple pour IndexedDB. Les messages lus depuis un
 * `$state` Svelte sont des proxys : le clone structuré d'IndexedDB refuse ces
 * proxys, et une écriture qui échoue ne doit jamais être masquée par un méta
 * plus récent.
 */
export function plainChatMessage(message: ChatMessageView): ChatMessageView {
	return {
		id: message.id,
		authorUserId: message.authorUserId,
		authorName: message.authorName,
		authorAvatarId: message.authorAvatarId,
		authorJerseyNumber: message.authorJerseyNumber,
		authorPosition: message.authorPosition,
		isOwn: message.isOwn,
		kind: message.kind,
		body: message.body,
		createdAt: message.createdAt,
		deleted: message.deleted,
		canDelete: message.canDelete,
		poll: message.poll
			? {
					question: message.poll.question,
					closesAt: message.poll.closesAt,
					closed: message.poll.closed,
					options: message.poll.options.map((option) => ({
						id: option.id,
						label: option.label,
						votes: option.votes,
						myVote: option.myVote
					}))
				}
			: null
	};
}

export function compareChatMessages(
	left: Pick<ChatMessageView, 'createdAt' | 'id'>,
	right: Pick<ChatMessageView, 'createdAt' | 'id'>
): number {
	if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
	return left.id.localeCompare(right.id);
}

export function isNewerChatMessage(
	candidate: Pick<ChatMessageView, 'createdAt' | 'id'>,
	reference: Pick<ChatMessageView, 'createdAt' | 'id'>
): boolean {
	return compareChatMessages(candidate, reference) > 0;
}

/**
 * La complétude se juge sur les lignes conservées, pas sur ce que la page a
 * parcouru : une éviction retire l'origine et la copie doit redevenir
 * partielle, sinon une relecture croirait l'historique entier présent.
 */
export function cacheIsComplete(reachesOrigin: boolean, evicted: number): boolean {
	return reachesOrigin && evicted === 0;
}

/**
 * Fusionne par identifiant : le message entrant gagne, parce qu'il vient d'une
 * lecture plus récente (suppression, vote, état du sondage).
 */
export function mergeChatMessages(
	existing: readonly ChatMessageView[],
	incoming: readonly ChatMessageView[]
): ChatMessageView[] {
	// Une page vide ne change rien : la même référence évite d'invalider
	// tout le fil à chaque synchronisation sans nouveau message.
	if (incoming.length === 0) return existing as ChatMessageView[];
	const byId = new Map(existing.map((message) => [message.id, message]));
	for (const message of incoming) byId.set(message.id, message);
	return [...byId.values()].sort(compareChatMessages);
}

/** Marque les messages supprimés sans perdre l'auteur ni l'heure. */
export function applyDeletedIds(
	messages: readonly ChatMessageView[],
	deletedIds: readonly string[]
): ChatMessageView[] {
	if (deletedIds.length === 0) return messages as ChatMessageView[];
	const deleted = new Set(deletedIds);
	let touched = false;
	const next = messages.map((message) => {
		if (deleted.has(message.id) && !message.deleted) {
			touched = true;
			return { ...message, body: null, deleted: true, poll: null, canDelete: false };
		}
		return message;
	});
	return touched ? next : (messages as ChatMessageView[]);
}

/**
 * Remplace l'état des sondages connus sans toucher au reste du message. Un
 * sondage sans état est supprimé : le serveur ne renvoie jamais un message de
 * type sondage sans son sondage, et la pierre tombale doit remplacer un corps
 * vide plutôt que laisser une ligne muette.
 */
export function applyPollStates(
	messages: readonly ChatMessageView[],
	polls: readonly { id: string; poll: ChatPollView | null }[]
): ChatMessageView[] {
	if (polls.length === 0) return messages as ChatMessageView[];
	const states = new Map(polls.map((entry) => [entry.id, entry.poll]));
	let touched = false;
	const next = messages.map((message) => {
		if (!states.has(message.id)) return message;
		touched = true;
		const poll = states.get(message.id) ?? null;
		if (poll === null && message.kind === 'poll') {
			return { ...message, body: null, deleted: true, poll: null, canDelete: false };
		}
		return { ...message, poll };
	});
	return touched ? next : (messages as ChatMessageView[]);
}

/**
 * Les curseurs se déduisent toujours des messages conservés : un cache partiel
 * sait exactement où reprendre vers le passé et vers le présent.
 */
export function chatCacheMeta(
	messages: readonly ChatMessageView[],
	options: { complete: boolean; syncedAt: number | null }
): ChatCacheMeta {
	const oldest = messages[0];
	const latest = messages.at(-1);
	return {
		oldestCursor: oldest ? encodeCursor(oldest) : null,
		latestCursor: latest ? encodeCursor(latest) : null,
		complete: options.complete,
		syncedAt: options.syncedAt
	};
}

export function chatCacheSnapshot(
	messages: readonly ChatMessageView[],
	options: { complete: boolean; syncedAt: number | null }
): ChatCacheSnapshot {
	const sorted = [...messages].sort(compareChatMessages);
	return { messages: sorted, ...chatCacheMeta(sorted, options) };
}
