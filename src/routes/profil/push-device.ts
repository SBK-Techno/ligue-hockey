import { PUSH_DEVICE } from '#config/push.ts';

/** Le service worker n'a pas répondu dans la borne : l'écran doit le dire. */
export class PushDeviceTimeout extends Error {
	constructor() {
		super('Le service worker n’a pas répondu à temps.');
		this.name = 'PushDeviceTimeout';
	}
}

/**
 * `navigator.serviceWorker.ready` ne rejette jamais : sans borne, la page
 * resterait sur « Chargement… » indéfiniment. Cette attente unique sert le
 * chargement, l'activation et la désactivation de l'appareil.
 */
export async function serviceWorkerRegistration(
	timeoutMs: number = PUSH_DEVICE.readyTimeoutMs
): Promise<ServiceWorkerRegistration> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			navigator.serviceWorker.ready,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new PushDeviceTimeout()), timeoutMs);
			})
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
