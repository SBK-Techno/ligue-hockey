import { afterEach, describe, expect, it, vi } from 'vitest';
import { PushDeviceTimeout, serviceWorkerRegistration } from './push-device.ts';

const registration = { scope: '/' } as ServiceWorkerRegistration;

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('attente du service worker', () => {
	it('rend l’inscription dès qu’elle est prête', async () => {
		vi.stubGlobal('navigator', {
			serviceWorker: { ready: Promise.resolve(registration) }
		});

		await expect(serviceWorkerRegistration(1_000)).resolves.toBe(registration);
	});

	it('échoue dans la borne au lieu d’attendre indéfiniment', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('navigator', {
			serviceWorker: { ready: new Promise<never>(() => {}) }
		});

		const pending = serviceWorkerRegistration(5_000);
		const assertion = expect(pending).rejects.toBeInstanceOf(PushDeviceTimeout);

		await vi.advanceTimersByTimeAsync(5_000);
		await assertion;
	});
});
