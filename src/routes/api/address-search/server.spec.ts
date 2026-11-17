import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';
import { AppError } from '#lib/shared/errors.ts';

vi.mock('#lib/server/geocoding.ts', () => ({
	searchAddresses: vi.fn()
}));

const { searchAddresses } = await import('#lib/server/geocoding.ts');
const { GET } = await import('./+server.ts');

const player: Actor = {
	kind: 'user',
	active: true,
	userId: 'player',
	name: 'Joueur',
	role: 'player'
};

const manager: Actor = {
	kind: 'user',
	active: true,
	userId: 'manager',
	name: 'Gérant',
	role: 'manager'
};

async function call(actor: Actor, query: string) {
	const url = new URL('http://localhost/api/address-search');
	url.searchParams.set('q', query);
	return GET({ locals: { actor }, url } as never);
}

beforeEach(() => {
	vi.mocked(searchAddresses).mockReset();
});

describe('recherche d’adresses', () => {
	it('refuse un compte sans session', async () => {
		const response = await call({ kind: 'anonymous' }, 'Trois-Rivières');

		expect(response.status).toBe(401);
	});

	it('refuse un membre qui ne gère pas les matchs', async () => {
		const response = await call(player, 'Trois-Rivières');

		expect(response.status).toBe(403);
		expect(searchAddresses).not.toHaveBeenCalled();
	});

	it('exige au moins trois caractères', async () => {
		const response = await call(manager, 'Tr');

		expect(response.status).toBe(400);
		expect(searchAddresses).not.toHaveBeenCalled();
	});

	it('rend les suggestions normalisées', async () => {
		vi.mocked(searchAddresses).mockResolvedValue([
			{ id: 'N:1', label: 'Aréna, Trois-Rivières', mapUrl: 'https://example.test/1' }
		]);

		const response = await call(manager, '  Aréna  ');

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			results: [
				{ id: 'N:1', label: 'Aréna, Trois-Rivières', mapUrl: 'https://example.test/1' }
			]
		});
		expect(searchAddresses).toHaveBeenCalledWith('Aréna');
	});

	it('garde l’enveloppe d’erreur du fournisseur', async () => {
		vi.mocked(searchAddresses).mockRejectedValue(
			new AppError('INTERNAL', { key: 'admin.addressSearchUnavailable' })
		);

		const response = await call(manager, 'Trois-Rivières');

		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({
			ok: false,
			key: 'admin.addressSearchUnavailable'
		});
	});
});
