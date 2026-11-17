import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
	games: [] as {
		id: string;
		status: string;
		gameDate: string;
		startTime: string;
		generatedAt: number | null;
		lineupManualAt: number | null;
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

const { flushUpcomingRegeneration, regenerateUpcomingGeneratedGames, stopUpcomingRegeneration } =
	await import('./upcoming.ts');

beforeEach(() => {
	h.games = [];
	h.regenerateGame.mockReset();
	vi.useFakeTimers();
});

afterEach(() => {
	flushUpcomingRegeneration();
	vi.useRealTimers();
});

describe('regenerateUpcomingGeneratedGames', () => {
	it('recalcule seulement les matchs à venir déjà publiés', () => {
		h.games = [
			{ id: 'scheduled', status: 'scheduled', gameDate: '2999-01-04', startTime: '09:00', generatedAt: 1, lineupManualAt: null },
			{ id: 'draft', status: 'scheduled', gameDate: '2999-01-11', startTime: '09:00', generatedAt: null, lineupManualAt: null },
			{ id: 'cancelled', status: 'cancelled', gameDate: '2999-01-18', startTime: '09:00', generatedAt: 1, lineupManualAt: null },
			{ id: 'manual', status: 'scheduled', gameDate: '2999-01-25', startTime: '09:00', generatedAt: 1, lineupManualAt: 2 }
		];

		regenerateUpcomingGeneratedGames();
		const result = flushUpcomingRegeneration();

		expect(h.regenerateGame).toHaveBeenCalledTimes(1);
		expect(h.regenerateGame).toHaveBeenCalledWith('scheduled');
		expect(result).toEqual({ regenerated: 1, failed: 0 });
	});

	it('laisse intact un alignement enregistré à la main', () => {
		h.games = [
			{ id: 'manual', status: 'scheduled', gameDate: '2999-01-04', startTime: '09:00', generatedAt: 1, lineupManualAt: 2 }
		];

		regenerateUpcomingGeneratedGames();
		const result = flushUpcomingRegeneration();

		expect(h.regenerateGame).not.toHaveBeenCalled();
		expect(result).toEqual({ regenerated: 0, failed: 0 });
	});

	it('continue avec les autres matchs quand un recalcul échoue', () => {
		h.games = [
			{ id: 'broken', status: 'scheduled', gameDate: '2999-01-04', startTime: '09:00', generatedAt: 1, lineupManualAt: null },
			{ id: 'healthy', status: 'scheduled', gameDate: '2999-01-11', startTime: '09:00', generatedAt: 1, lineupManualAt: null }
		];
		h.regenerateGame.mockImplementation((gameId: string) => {
			if (gameId === 'broken') throw new Error('notes incomplètes');
			return {};
		});

		regenerateUpcomingGeneratedGames();
		const result = flushUpcomingRegeneration();

		expect(h.regenerateGame).toHaveBeenCalledTimes(2);
		expect(result).toEqual({ regenerated: 1, failed: 1 });
	});

	it('regroupe des écritures rapides en un seul balayage', () => {
		h.games = [
			{ id: 'scheduled', status: 'scheduled', gameDate: '2999-01-04', startTime: '09:00', generatedAt: 1, lineupManualAt: null }
		];

		regenerateUpcomingGeneratedGames();
		regenerateUpcomingGeneratedGames();
		regenerateUpcomingGeneratedGames();
		expect(h.regenerateGame).not.toHaveBeenCalled();

		vi.advanceTimersByTime(249);
		expect(h.regenerateGame).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(h.regenerateGame).toHaveBeenCalledTimes(1);
	});

	it('vide le balayage en attente à l’arrêt du serveur', () => {
		h.games = [
			{ id: 'scheduled', status: 'scheduled', gameDate: '2999-01-04', startTime: '09:00', generatedAt: 1, lineupManualAt: null }
		];

		regenerateUpcomingGeneratedGames();
		stopUpcomingRegeneration();

		expect(h.regenerateGame).toHaveBeenCalledTimes(1);
	});
});
