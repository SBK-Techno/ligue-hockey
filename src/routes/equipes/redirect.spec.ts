import { isRedirect } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';

vi.mock('#lib/domain/games/service.ts', () => ({
	listSchedule: vi.fn()
}));

const { listSchedule } = await import('#lib/domain/games/service.ts');
const { load } = await import('./+page.server.ts');

const player: Actor = {
	kind: 'user',
	active: true,
	userId: 'player',
	name: 'Joueur',
	role: 'player'
};

const anonymous: Actor = { kind: 'anonymous' };

function game(
	id: string,
	gameDate: string,
	status: GameSummary['status'] = 'scheduled'
): GameSummary {
	return {
		id,
		gameDate,
		startTime: '08:30',
		locationId: 'loc',
		location: 'Aréna',
		status
	};
}

async function run(actor: Actor, games: GameSummary[]) {
	vi.mocked(listSchedule).mockReturnValue(games);
	return load({ locals: { actor } } as never);
}

async function redirectFor(actor: Actor, games: GameSummary[]) {
	try {
		await run(actor, games);
	} catch (error) {
		expect(isRedirect(error)).toBe(true);
		return error as { status: number; location: string };
	}
	throw new Error('Aucune redirection reçue');
}

beforeEach(() => {
	vi.mocked(listSchedule).mockReset();
});

describe('redirection de la section Équipes', () => {
	it('ouvre le prochain match programmé', async () => {
		const redirect = await redirectFor(player, [
			game('later', '2099-01-12'),
			game('next', '2099-01-05')
		]);

		expect(redirect.status).toBe(303);
		expect(redirect.location).toBe('/equipes/next');
	});

	it('garde un match annulé quand aucun match n’est programmé', async () => {
		const redirect = await redirectFor(player, [game('cancelled', '2099-01-05', 'cancelled')]);

		expect(redirect.location).toBe('/equipes/cancelled');
	});

	it('retombe sur le dernier match passé hors saison', async () => {
		const redirect = await redirectFor(player, [
			game('old', '2020-01-05', 'completed'),
			game('recent', '2020-02-05', 'completed')
		]);

		expect(redirect.location).toBe('/equipes/recent');
	});

	it('ne redirige pas un compte sans session', async () => {
		const data = await run(anonymous, [game('next', '2099-01-05')]);

		expect(data).toEqual({});
		expect(listSchedule).not.toHaveBeenCalled();
	});

	it('laisse la page vide sans calendrier', async () => {
		const data = await run(player, []);

		expect(data).toEqual({});
	});
});
