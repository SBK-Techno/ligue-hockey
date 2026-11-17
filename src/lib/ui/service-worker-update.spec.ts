import { describe, expect, it } from 'vitest';
import { serviceWorkerUpdateHandler } from './service-worker-update.ts';

describe('mise à jour du service worker', () => {
	it('ne recharge pas une page qui n’était pas encore contrôlée', () => {
		let reloads = 0;
		const onChange = serviceWorkerUpdateHandler({
			controlled: false,
			reload: () => {
				reloads += 1;
			}
		});

		onChange();

		expect(reloads).toBe(0);
	});

	it('recharge une page contrôlée une seule fois', () => {
		let reloads = 0;
		const onChange = serviceWorkerUpdateHandler({
			controlled: true,
			reload: () => {
				reloads += 1;
			}
		});

		onChange();
		onChange();

		expect(reloads).toBe(1);
	});
});
