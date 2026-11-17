import { clearChatCache } from './chat-cache-idb.ts';
import { clearChatPosition } from './chat-position.ts';

/** Un stockage qui ne répond pas ne retient jamais la déconnexion. */
const CLEAR_TIMEOUT_MS = 1_500;

function withTimeout<T>(task: Promise<T>, milliseconds: number): Promise<T | null> {
	return Promise.race([
		task,
		new Promise<null>((resolve) => setTimeout(() => resolve(null), milliseconds))
	]);
}

/**
 * La déconnexion efface la copie locale de la conversation et la position de
 * lecture du membre avant de rendre la main au serveur. Une panne du stockage
 * local ne bloque jamais la déconnexion : le cache est best-effort, la session
 * reste la seule autorité.
 */
export async function signOutWithCleanup(
	event: SubmitEvent & { currentTarget: HTMLFormElement },
	userId: string
): Promise<void> {
	event.preventDefault();
	const form = event.currentTarget;
	await Promise.allSettled([
		withTimeout(clearChatCache(userId), CLEAR_TIMEOUT_MS),
		Promise.resolve(clearChatPosition(userId))
	]);
	form.submit();
}
