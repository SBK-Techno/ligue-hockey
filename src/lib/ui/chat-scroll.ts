export type ChatPillState = {
	/** Nombre de messages déjà vus; initialisé au premier rendu. */
	previousCount: number;
	/** Messages arrivés depuis, quand le lecteur n'est pas en bas. */
	newMessages: number;
};

/** Le premier rendu ne compte jamais l'historique comme nouveau. */
export function initialPillState(count: number): ChatPillState {
	return { previousCount: count, newMessages: 0 };
}

/**
 * Le seul calcul de la pastille : un message arrivé pendant que le lecteur
 * est en bas ne compte pas (il est visible), un message arrivé pendant qu'il
 * est remonté compte. Un historique qui rétrécit ajuste le compteur sans
 * inventer de nouveau message.
 */
export function nextPillState(
	state: ChatPillState,
	count: number,
	nearBottom: boolean
): ChatPillState {
	if (count === state.previousCount) return state;
	if (count < state.previousCount) return { ...state, previousCount: count };
	return {
		previousCount: count,
		newMessages: nearBottom
			? state.newMessages
			: state.newMessages + (count - state.previousCount)
	};
}
