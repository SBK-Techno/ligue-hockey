import { beforeEach, describe, expect, it } from 'vitest';
import { GET as getPeek } from '../../routes/api/joueurs/[id]/+server.ts';
import { POST as postPush } from '../../routes/api/push/abonnement/+server.ts';
import { AppError } from '#lib/shared/errors.ts';
import { memberThrottleResponse } from './action.ts';
import { resetThrottle } from '#lib/server/security/throttle.ts';

const anonymous = { kind: 'anonymous' as const };

function event(request: Request) {
	return { locals: { actor: anonymous }, params: { id: 'inconnu' }, request } as never;
}

async function body(response: Response): Promise<Record<string, unknown>> {
	return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
	resetThrottle();
});

describe('refus du limiteur de membre', () => {
	it('rend un échec d’action à un formulaire enrichi', async () => {
		const request = new Request('http://localhost/discussion?/send', {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' }
		});
		const response = memberThrottleResponse(new AppError('RATE_LIMITED'), request);
		const payload = await body(response);

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			type: 'failure',
			status: 429,
			data: { ok: false, key: 'error.rateLimited', message: expect.any(String) }
		});
	});

	it('garde l’enveloppe JSON pour une API', async () => {
		const request = new Request('http://localhost/api/push/abonnement', {
			method: 'POST',
			headers: { accept: 'application/json' }
		});
		const response = memberThrottleResponse(new AppError('RATE_LIMITED'), request);
		const payload = await body(response);

		expect(response.status).toBe(429);
		expect(payload).toMatchObject({ ok: false, key: 'error.rateLimited' });
		expect(payload).not.toHaveProperty('type');
	});
});

describe('enveloppe d’erreur des routes JSON', () => {
	it('renvoie ok, key et message pour une fiche refusée', async () => {
		const response = await getPeek(event(new Request('http://localhost/api/joueurs/inconnu')));
		const payload = await body(response);

		expect(response.status).toBe(401);
		expect(payload).toMatchObject({
			ok: false,
			key: 'error.sessionRequired',
			message: expect.any(String)
		});
	});

	it('renvoie la même enveloppe pour un abonnement refusé', async () => {
		const response = await postPush(
			event(
				new Request('http://localhost/api/push/abonnement', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ endpoint: 'https://push.example/1', keys: {} })
				})
			)
		);
		const payload = await body(response);

		expect(response.status).toBe(401);
		expect(payload).toMatchObject({
			ok: false,
			key: 'error.sessionRequired',
			message: expect.any(String)
		});
	});
});
