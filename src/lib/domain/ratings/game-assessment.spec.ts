import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../auth/types.ts';

type StoredRating = {
	gameId: string;
	playerId: string;
	attribute: string;
	value: number;
	updatedAt: number;
};

const { getGame, listSchedule, replaceGameRatings, listGameRatings, recordAudit, store } =
	vi.hoisted(() => {
		const store = new Map<string, StoredRating[]>();
		const listGameRatings = vi.fn(() => [...store.values()].flat());
		const replaceGameRatings = vi.fn(
			(
				gameId: string,
				playerId: string,
				values: Record<string, number>,
				updatedAt: number
			) => {
				store.set(
					playerId,
					Object.entries(values).map(([attribute, value]) => ({
						gameId,
						playerId,
						attribute,
						value,
						updatedAt
					}))
				);
			}
		);
		return {
			getGame: vi.fn(),
			listSchedule: vi.fn(),
			replaceGameRatings,
			listGameRatings,
			recordAudit: vi.fn(),
			store
		};
	});

vi.mock('#lib/domain/games/service.ts', () => ({ getGame, listSchedule }));
vi.mock('./queries.ts', () => ({
	listGameRatings,
	replaceGameRatings,
	listPlayerGameRatings: vi.fn(() => []),
	listRatings: vi.fn(() => []),
	listRatingsForPlayers: vi.fn(() => []),
	upsertRatings: vi.fn()
}));
vi.mock('#lib/domain/audit/service.ts', () => ({ recordAudit }));
vi.mock('#lib/domain/players/service.ts', () => ({
	getPlayer: vi.fn(),
	listRatingPlayers: vi.fn(() => [])
}));
vi.mock('#lib/domain/games/upcoming.ts', () => ({
	regenerateUpcomingGeneratedGames: vi.fn()
}));

const admin: Actor = { kind: 'user', active: true, userId: 'admin', name: 'Admin', role: 'admin' };
const manager: Actor = { kind: 'user', active: true, userId: 'manager', name: 'Manager', role: 'manager' };

function game(overrides: Record<string, unknown> = {}) {
	return {
		id: 'game-1',
		gameDate: '2026-11-15',
		startTime: '09:00',
		status: 'completed',
		location: 'Aréna de la Rive',
		generated: true,
		slots: [
			{
				player: {
					playerId: 'p1',
					fullName: 'Alex Tremblay',
					position: 'forward',
					jerseyNumber: 9
				}
			},
			{
				player: {
					playerId: 'p2',
					fullName: 'Félix Morin',
					position: 'goalie',
					jerseyNumber: 31
				}
			}
		],
		...overrides
	};
}

function thrownBy(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	return undefined;
}

const skaterValues = { impact: 4, effort: 5, decisions: 3, discipline: 4 };

describe('saveGameAssessment', () => {
	beforeEach(() => {
		store.clear();
		getGame.mockClear();
		listSchedule.mockClear();
		replaceGameRatings.mockClear();
		listGameRatings.mockClear();
		recordAudit.mockClear();
		getGame.mockReturnValue(game());
		listSchedule.mockReturnValue([]);
	});

	it('saves the four skater criteria for a dressed player', async () => {
		const { saveGameAssessment } = await import('./service.ts');

		saveGameAssessment(admin, 'game-1', 'p1', skaterValues);

		expect(replaceGameRatings).toHaveBeenCalledWith(
			'game-1',
			'p1',
			skaterValues,
			expect.any(Number),
			'admin'
		);
	});

	it('uses the goalie criteria for a goalie', async () => {
		const { saveGameAssessment } = await import('./service.ts');

		saveGameAssessment(admin, 'game-1', 'p2', {
			goaliePositioning: 4,
			reboundControl: 3,
			puckHandling: 4,
			composure: 5
		});

		expect(replaceGameRatings).toHaveBeenCalledWith(
			'game-1',
			'p2',
			{ goaliePositioning: 4, reboundControl: 3, puckHandling: 4, composure: 5 },
			expect.any(Number),
			'admin'
		);
	});

	it('clears a player when nothing was observed and audits the counts only', async () => {
		const { saveGameAssessment } = await import('./service.ts');
		saveGameAssessment(admin, 'game-1', 'p1', skaterValues);
		recordAudit.mockClear();

		saveGameAssessment(admin, 'game-1', 'p1', {});

		expect(replaceGameRatings).toHaveBeenLastCalledWith(
			'game-1',
			'p1',
			{},
			expect.any(Number),
			'admin'
		);
		expect(recordAudit).toHaveBeenLastCalledWith(
			admin,
			expect.objectContaining({
				metadata: expect.objectContaining({
					previousAttributes: 4,
					cleared: true
				})
			})
		);
	});

	it('keeps the rows when the same values are saved twice unchanged', async () => {
		const { saveGameAssessment } = await import('./service.ts');

		const first = saveGameAssessment(admin, 'game-1', 'p1', skaterValues);
		const player = first.players.find((entry) => entry.playerId === 'p1');
		expect(player?.complete).toBe(true);

		saveGameAssessment(admin, 'game-1', 'p1', player?.values ?? {});

		expect(store.get('p1')).toHaveLength(4);
		const second = saveGameAssessment(admin, 'game-1', 'p1', player?.values ?? {});
		expect(second.players.find((entry) => entry.playerId === 'p1')?.rated).toBe(4);
	});

	it('does not count a partial assessment as complete', async () => {
		const { getGameAssessment } = await import('./service.ts');
		store.set('p1', [
			{
				gameId: 'game-1',
				playerId: 'p1',
				attribute: 'impact',
				value: 4,
				updatedAt: 1
			}
		]);

		const view = getGameAssessment(admin, 'game-1');
		const player = view.players.find((entry) => entry.playerId === 'p1');

		expect(player).toMatchObject({ rated: 1, total: 4, complete: false });
		expect(view.ratedPlayers).toBe(0);
	});

	it('ignores a stored criterion that the current slot position forbids', async () => {
		const { getGameAssessment } = await import('./service.ts');
		store.set('p1', [
			{
				gameId: 'game-1',
				playerId: 'p1',
				attribute: 'goaliePositioning',
				value: 4,
				updatedAt: 1
			}
		]);

		const player = getGameAssessment(admin, 'game-1').players.find(
			(entry) => entry.playerId === 'p1'
		);

		expect(player).toMatchObject({ rated: 0, total: 4, complete: false });
	});

	it('rejects a criterion from another position', async () => {
		const { saveGameAssessment } = await import('./service.ts');

		expect(
			thrownBy(() =>
				saveGameAssessment(admin, 'game-1', 'p1', { goaliePositioning: 4 })
			)
		).toMatchObject({ code: 'VALIDATION' });
		expect(replaceGameRatings).not.toHaveBeenCalled();
	});

	it('rejects a player who is not in the lineup', async () => {
		const { saveGameAssessment } = await import('./service.ts');

		expect(
			thrownBy(() => saveGameAssessment(admin, 'game-1', 'outsider', { impact: 4 }))
		).toMatchObject({ code: 'VALIDATION' });
	});

	it('rejects a cancelled game even when it is in the past', async () => {
		const { saveGameAssessment } = await import('./service.ts');
		getGame.mockReturnValue(
			game({ status: 'cancelled', gameDate: '2020-01-01' })
		);

		expect(
			thrownBy(() => saveGameAssessment(admin, 'game-1', 'p1', skaterValues))
		).toMatchObject({ code: 'CONFLICT', key: 'rating.gameCancelled' });
	});

	it('rejects a game whose teams are not generated', async () => {
		const { saveGameAssessment } = await import('./service.ts');
		getGame.mockReturnValue(game({ generated: false }));

		expect(
			thrownBy(() => saveGameAssessment(admin, 'game-1', 'p1', skaterValues))
		).toMatchObject({ code: 'CONFLICT', key: 'rating.gameNotGenerated' });
	});

	it('rejects a game that has not been played', async () => {
		const { saveGameAssessment } = await import('./service.ts');
		getGame.mockReturnValue(
			game({ status: 'scheduled', gameDate: '2099-01-01' })
		);

		expect(
			thrownBy(() => saveGameAssessment(admin, 'game-1', 'p1', skaterValues))
		).toMatchObject({ code: 'CONFLICT' });
	});

	it('denies an actor without the rating capability', async () => {
		const { saveGameAssessment } = await import('./service.ts');

		expect(
			thrownBy(() => saveGameAssessment(manager, 'game-1', 'p1', skaterValues))
		).toMatchObject({ code: 'FORBIDDEN' });
		expect(replaceGameRatings).not.toHaveBeenCalled();
	});
});

describe('playedGamesForAssessment', () => {
	beforeEach(() => {
		store.clear();
		getGame.mockClear();
		listSchedule.mockClear();
		listGameRatings.mockClear();
		getGame.mockReturnValue(game());
	});

	it('keeps generated playable games with at least one dressed player', async () => {
		const { playedGamesForAssessment } = await import('./service.ts');
		listSchedule.mockReturnValue([
			{ id: 'empty', gameDate: '2026-11-14', startTime: '09:00', location: 'A', status: 'completed' },
			{ id: 'cancelled', gameDate: '2026-11-15', startTime: '09:00', location: 'B', status: 'cancelled' },
			{ id: 'ready', gameDate: '2026-11-16', startTime: '09:00', location: 'C', status: 'completed' }
		]);
		getGame.mockImplementation((_actor: Actor, id: string) => {
			if (id === 'empty') return { ...game({ id }), slots: [] };
			if (id === 'cancelled') return game({ id, status: 'cancelled' });
			return game({ id: 'ready' });
		});

		const games = playedGamesForAssessment(admin);

		expect(games.map((entry) => entry.gameId)).toEqual(['ready']);
	});
});
