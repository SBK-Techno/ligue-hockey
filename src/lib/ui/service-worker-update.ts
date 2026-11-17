/**
 * Une page déjà ouverte garde son ancien manifeste de routes quand un nouveau
 * service worker prend le contrôle. Les morceaux hachés de l'ancien manifeste
 * ne sont plus servis, donc la navigation suivante échoue. On recharge la page
 * une seule fois, et seulement si elle était déjà contrôlée : la première
 * installation n'a pas d'ancien manifeste à remplacer.
 */

export type ServiceWorkerUpdate = {
	controlled: boolean;
	reload: () => void;
};

export function serviceWorkerUpdateHandler({ controlled, reload }: ServiceWorkerUpdate): () => void {
	let reloading = false;
	return () => {
		if (!controlled || reloading) return;
		reloading = true;
		reload();
	};
}

export function reloadOnServiceWorkerUpdate(): () => void {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
	const onChange = serviceWorkerUpdateHandler({
		controlled: Boolean(navigator.serviceWorker.controller),
		reload: () => location.reload()
	});
	navigator.serviceWorker.addEventListener('controllerchange', onChange);
	return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange);
}
