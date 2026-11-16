import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
	games: [] as {
		id: string;
		status: string;
		gameDate: string;
		startTime: string;
		generatedAt: number | null;
	}[],
	regenerateGame: vi.fn()
}));

vi.mock('./queries.ts', () => ({
	listGames: () => h.games
}));

vi.mock('./service.ts', () => ({
	regenerateGame: h.regenerateGame
}));

vi.mock('#lib/shared/logging/logger.ts', () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

const { regenerateUpcomingGeneratedGames } = await import('./upcoming.ts');

beforeEach(() => {
	h.games = [];
	h.regenerateGame.mockReset();
});

describe('regenerateUpcomingGeneratedGames', () => {
	it('recalcule seulement les matchs à venir déjà publiés', () => {
		h.games = [
			{ id: 'scheduled', status: 'scheduled', gameDate: '2999-01-04', startTime: '09:00', generatedAt: 1 },
			{ id: 'draft', status: 'scheduled', gameDate: '2999-01-11', startTime: '09:00', generatedAt: null },
			{ id: 'cancelled', status: 'cancelled', gameDate: '2999-01-18', startTime: '09:00', generatedAt: 1 }
		];

		const result = regenerateUpcomingGeneratedGames();

		expect(h.regenerateGame).toHaveBeenCalledTimes(1);
		expect(h.regenerateGame).toHaveBeenCalledWith('scheduled');
		expect(result).toEqual({ regenerated: 1, failed: 0 });
	});

	it('continue avec les autres matchs quand un recalcul échoue', () => {
		h.games = [
			{ id: 'broken', status: 'scheduled', gameDate: '2999-01-04', startTime: '09:00', generatedAt: 1 },
			{ id: 'healthy', status: 'scheduled', gameDate: '2999-01-11', startTime: '09:00', generatedAt: 1 }
		];
		h.regenerateGame.mockImplementation((gameId: string) => {
			if (gameId === 'broken') throw new Error('notes incomplètes');
			return {};
		});

		const result = regenerateUpcomingGeneratedGames();

		expect(h.regenerateGame).toHaveBeenCalledTimes(2);
		expect(result).toEqual({ regenerated: 1, failed: 1 });
	});
});
