import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../auth/types.ts';

const { getGame, replaceGameRatings, listGameRatings, recordAudit } = vi.hoisted(() => ({
	getGame: vi.fn(),
	replaceGameRatings: vi.fn(),
	listGameRatings: vi.fn(() => []),
	recordAudit: vi.fn()
}));

vi.mock('#lib/domain/games/service.ts', () => ({ getGame }));
vi.mock('./queries.ts', () => ({
	listGameRatings,
	replaceGameRatings,
	listPlayerGameRatings: vi.fn(() => []),
	listRatings: vi.fn(() => []),
	upsertRatings: vi.fn(),
	listRecentAssessments: vi.fn(() => [])
}));
vi.mock('#lib/domain/audit/service.ts', () => ({ recordAudit }));
vi.mock('#lib/domain/players/service.ts', () => ({
	getPlayer: vi.fn(),
	listAdminPlayers: vi.fn(() => [])
}));
vi.mock('#lib/domain/games/upcoming.ts', () => ({
	regenerateUpcomingGeneratedGames: vi.fn()
}));

const admin: Actor = { kind: 'user', userId: 'admin', name: 'Admin', role: 'admin' };
const manager: Actor = { kind: 'user', userId: 'manager', name: 'Manager', role: 'manager' };

function game(overrides: Record<string, unknown> = {}) {
	return {
		id: 'game-1',
		gameDate: '2026-11-15',
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

describe('saveGameAssessment', () => {
	beforeEach(() => {
		getGame.mockClear();
		replaceGameRatings.mockClear();
		listGameRatings.mockClear();
		listGameRatings.mockReturnValue([]);
		recordAudit.mockClear();
		getGame.mockReturnValue(game());
	});

	it('saves the four skater criteria for a dressed player', async () => {
		const { saveGameAssessment } = await import('./service.ts');

		saveGameAssessment(admin, 'game-1', 'p1', {
			impact: 4,
			effort: 5,
			decisions: 3,
			discipline: 4
		});

		expect(replaceGameRatings).toHaveBeenCalledWith(
			'game-1',
			'p1',
			{ impact: 4, effort: 5, decisions: 3, discipline: 4 },
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

	it('clears a player when nothing was observed', async () => {
		const { saveGameAssessment } = await import('./service.ts');

		saveGameAssessment(admin, 'game-1', 'p1', {});

		expect(replaceGameRatings).toHaveBeenCalledWith(
			'game-1',
			'p1',
			{},
			expect.any(Number),
			'admin'
		);
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

	it('rejects a game that has not been played', async () => {
		const { saveGameAssessment } = await import('./service.ts');
		getGame.mockReturnValue(game({ status: 'scheduled', gameDate: '2099-01-01' }));

		expect(
			thrownBy(() => saveGameAssessment(admin, 'game-1', 'p1', { impact: 4 }))
		).toMatchObject({ code: 'CONFLICT' });
	});

	it('denies an actor without the rating capability', async () => {
		const { saveGameAssessment } = await import('./service.ts');

		expect(
			thrownBy(() => saveGameAssessment(manager, 'game-1', 'p1', { impact: 4 }))
		).toMatchObject({ code: 'FORBIDDEN' });
		expect(replaceGameRatings).not.toHaveBeenCalled();
	});
});
