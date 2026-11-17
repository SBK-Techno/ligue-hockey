import { describe, expect, it } from 'vitest';
import {
	claimablePositions,
	compareOpenRequests,
	computeSubRequestWaves,
	isTooLateForSubRequest
} from './policy.ts';

const gameStartMs = Date.UTC(2026, 10, 22, 13, 0);
const hour = 60 * 60 * 1000;
const minute = 60 * 1000;

function waves(nowMs: number) {
	return computeSubRequestWaves({
		gameStartMs,
		nowMs,
		generalLeadHours: 2,
		priorityGapHours: 4,
		lastCallMinutes: 30
	});
}

describe('computeSubRequestWaves', () => {
	it('schedules favourites exactly four hours before the general list', () => {
		const result = waves(gameStartMs - 48 * hour);

		expect(result.favoriteAt).toBe(gameStartMs - 6 * hour);
		expect(result.generalAt).toBe(gameStartMs - 2 * hour);
		expect(result.generalAt - result.favoriteAt).toBe(4 * hour);
	});

	it('keeps the favourite head start when their window has passed', () => {
		const now = gameStartMs - 3 * hour;
		const result = waves(now);

		expect(result.favoriteAt).toBe(now + minute);
		// La vague générale est repoussée au dernier appel pour préserver l'avance.
		expect(result.generalAt).toBe(gameStartMs - 30 * minute);
		expect(result.generalAt - result.favoriteAt).toBeGreaterThan(2 * hour);
	});

	it('keeps the favourite head start when the request is late', () => {
		const now = gameStartMs - hour;
		const result = waves(now);

		expect(result.favoriteAt).toBe(now + minute);
		expect(result.generalAt).toBe(gameStartMs - 30 * minute);
		expect(result.generalAt).toBeGreaterThan(result.favoriteAt);
	});

	it('always leaves favourites ahead of the general list, up to last call', () => {
		for (let hours = 1; hours <= 48; hours += 1) {
			const now = gameStartMs - hours * hour;
			const result = waves(now);
			expect(result.generalAt).toBeGreaterThanOrEqual(result.favoriteAt);
			expect(result.generalAt - result.favoriteAt).toBeGreaterThan(0);
		}
	});

	it('never schedules after the last-call cutoff', () => {
		const now = gameStartMs - 10 * minute;
		const result = waves(now);
		const cutoff = gameStartMs - 30 * minute;

		expect(result.favoriteAt).toBeGreaterThanOrEqual(now + minute);
		expect(result.generalAt).toBeLessThanOrEqual(Math.max(now + minute, cutoff));
	});

	it('keeps the favourite wave before the general wave', () => {
		for (let hours = 0; hours <= 48; hours += 1) {
			const result = waves(gameStartMs - hours * hour);
			expect(result.favoriteAt).toBeLessThanOrEqual(result.generalAt);
			expect(result.generalAt).toBeLessThanOrEqual(
				Math.max(gameStartMs - hours * hour + minute, gameStartMs - 30 * minute)
			);
		}
	});

	it('reports the last-call cutoff', () => {
		expect(isTooLateForSubRequest(gameStartMs, gameStartMs - 31 * minute, 30)).toBe(
			false
		);
		expect(isTooLateForSubRequest(gameStartMs, gameStartMs - 30 * minute, 30)).toBe(
			true
		);
	});
});

describe('claimable positions', () => {
	it('uses the saved preferences when they exist', () => {
		expect(claimablePositions(['defense', 'goalie'], 'forward')).toEqual(['defense', 'goalie']);
	});

	it('falls back to the primary position for a substitute without preferences', () => {
		expect(claimablePositions([], 'forward')).toEqual(['forward']);
	});

	it('returns nothing when the account has no player sheet', () => {
		expect(claimablePositions([], null)).toEqual([]);
	});
});

describe('ordre du bassin ouvert', () => {
	it('place le match le plus proche avant la demande la plus récente', () => {
		const later = { game: { gameDate: '2026-12-06', startTime: '19:00' }, createdAt: 1 };
		const soonerNew = { game: { gameDate: '2026-11-22', startTime: '19:00' }, createdAt: 50 };
		const soonerOld = { game: { gameDate: '2026-11-22', startTime: '19:00' }, createdAt: 10 };

		expect([later, soonerNew, soonerOld].sort(compareOpenRequests)).toEqual([
			soonerOld,
			soonerNew,
			later
		]);
	});

	it('compare l’heure du match, pas seulement sa date', () => {
		const evening = { game: { gameDate: '2026-11-22', startTime: '20:00' }, createdAt: 0 };
		const morning = { game: { gameDate: '2026-11-22', startTime: '09:00' }, createdAt: 99 };

		expect([evening, morning].sort(compareOpenRequests)).toEqual([morning, evening]);
	});
});
