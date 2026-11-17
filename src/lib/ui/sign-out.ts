/**
 * La déconnexion efface la copie locale avant de rendre la main au serveur.
 * Le nettoyage de l'appareil charge ses propres modules à ce moment seulement :
 * le menu de compte ne doit pas tirer le cache de la discussion dans le graphe
 * initial de toutes les pages. Une panne du stockage local ne bloque jamais la
 * déconnexion; la session reste la seule autorité.
 */
export function signOutWithCleanup(
	event: SubmitEvent & { currentTarget: HTMLFormElement },
	userId: string
): void {
	event.preventDefault();
	const form = event.currentTarget;
	void import('./sign-out-device.ts')
		.then(({ clearDeviceCopy }) => clearDeviceCopy(userId))
		.catch(() => undefined)
		.finally(() => form.submit());
}
