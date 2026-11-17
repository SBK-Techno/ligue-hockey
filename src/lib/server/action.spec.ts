import { beforeEach, describe, expect, it } from 'vitest';
import { GET as getPeek } from '../../routes/api/joueurs/[id]/+server.ts';
import { POST as postPush } from '../../routes/api/push/abonnement/+server.ts';
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
