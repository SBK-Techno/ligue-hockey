import { describe, expect, it } from 'vitest';
import { computeSubRequestWaves, isTooLateForSubRequest } from './policy.ts';

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

	it('sends favourites immediately when their window has passed', () => {
		const now = gameStartMs - 3 * hour;
		const result = waves(now);

		expect(result.favoriteAt).toBe(now + minute);
		expect(result.generalAt).toBe(gameStartMs - 2 * hour);
		expect(result.favoriteAt).toBeLessThan(result.generalAt);
	});

	it('sends both waves immediately when the request is late', () => {
		const now = gameStartMs - hour;
		const result = waves(now);

		expect(result.favoriteAt).toBe(now + minute);
		expect(result.generalAt).toBe(result.favoriteAt);
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
