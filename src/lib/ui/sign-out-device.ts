/** Un stockage qui ne répond pas ne retient jamais la déconnexion. */
const CLEAR_TIMEOUT_MS = 1_500;

function withTimeout<T>(task: Promise<T>, milliseconds: number): Promise<T | null> {
	return Promise.race([
		task,
		new Promise<null>((resolve) => setTimeout(() => resolve(null), milliseconds))
	]);
}

/**
 * Efface la conversation et la position du membre sur cet appareil. Les deux
 * propriétaires sont chargés ici, quand la déconnexion les demande, et non au
 * montage de la coquille.
 */
export async function clearDeviceCopy(userId: string): Promise<void> {
	await withTimeout(
		Promise.all([
			import('./chat-cache-idb.ts').then(({ clearChatCache }) => clearChatCache(userId)),
			import('./chat-position.ts').then(({ clearChatPosition }) => clearChatPosition(userId))
		]),
		CLEAR_TIMEOUT_MS
	);
}
