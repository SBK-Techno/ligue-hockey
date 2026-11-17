import { isNewerChatMessage } from './chat-cache.ts';

/**
 * L'état de la pastille « nouveaux messages » se mesure sur l'identité du
 * dernier message lu, jamais sur le nombre de lignes : charger une page plus
 * ancienne ne doit pas annoncer un nouveau message, et la fenêtre de vingt
 * messages ne doit pas masquer un message de plus. L'ordre (date, identifiant)
 * appartient au cache de conversation, comme la fusion du fil.
 */
export type ChatPillState = {
	/** Dernier message connu au moment de la dernière lecture. */
	newestId: string | null;
	newestAt: number;
	newMessages: number;
};

type Identified = { id: string; createdAt: number };

export function initialPillState(messages: readonly Identified[]): ChatPillState {
	const newest = messages.at(-1);
	return newest
		? { newestId: newest.id, newestAt: newest.createdAt, newMessages: 0 }
		: { newestId: null, newestAt: 0, newMessages: 0 };
}

/**
 * `messages` est trié du plus ancien au plus récent. Une lecture près du bas
 * acquitte tout de suite; une lecture plus haut garde le dernier message lu et
 * compte seulement ce qui est réellement plus récent.
 */
export function nextPillState(
	state: ChatPillState,
	messages: readonly Identified[],
	nearBottom: boolean
): ChatPillState {
	const newest = messages.at(-1);
	if (!newest) return state;
	const reference =
		state.newestId === null
			? null
			: { id: state.newestId, createdAt: state.newestAt };
	if (nearBottom) {
		if (state.newestId === newest.id && state.newestAt === newest.createdAt) return state;
		return {
			newestId: newest.id,
			newestAt: newest.createdAt,
			newMessages: 0
		};
	}
	if (!reference) return initialPillState(messages);
	const count = messages.filter((message) => isNewerChatMessage(message, reference)).length;
	if (count === state.newMessages) return state;
	return { ...state, newMessages: count };
}
