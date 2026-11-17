import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	MAX_BUCKETS,
	clearAttempts,
	recordAttempt,
	resetThrottle,
	throttleSize,
	tooManyAttempts
} from './throttle.ts';

beforeEach(() => {
	resetThrottle();
	vi.useFakeTimers();
	vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 0, 0));
});

afterEach(() => {
	vi.useRealTimers();
});

/** Une limite de zéro distingue une clé présente (compte >= 0) d'une absente. */
function present(key: string): boolean {
	return tooManyAttempts(key, 0);
}

describe('auth throttle', () => {
	it('blocks once the limit is reached and clears on success', () => {
		const key = 'test:login';
		expect(tooManyAttempts(key, 2)).toBe(false);
		recordAttempt(key, 60_000);
		expect(tooManyAttempts(key, 2)).toBe(false);
		recordAttempt(key, 60_000);
		expect(tooManyAttempts(key, 2)).toBe(true);
		clearAttempts(key);
		expect(tooManyAttempts(key, 2)).toBe(false);
	});

	it('borne le registre et garde la clé la plus récente', () => {
		for (let index = 0; index < 20_000; index += 1) {
			recordAttempt(`unique:${index}`, 60_000);
		}

		expect(MAX_BUCKETS).toBe(10_000);
		expect(throttleSize()).toBe(MAX_BUCKETS);
		expect(present('unique:19999')).toBe(true);
		expect(present('unique:0')).toBe(false);
	});

	it('évince les clés expirées avant les clés vivantes', () => {
		for (let index = 0; index < MAX_BUCKETS; index += 1) {
			recordAttempt(`short:${index}`, 1_000);
		}
		vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 0, 5));

		recordAttempt('fresh', 60_000);

		expect(present('fresh')).toBe(true);
		expect(present('short:0')).toBe(false);
	});

	it('rafraîchit la clé à chaque tentative et garde les plus actives', () => {
		for (let index = 0; index < MAX_BUCKETS; index += 1) {
			recordAttempt(`key:${index}`, 60_000);
		}
		// La clé la plus ancienne redevient récente par une lecture, puis une
		// nouvelle clé force l'éviction d'une autre.
		expect(tooManyAttempts('key:0', 2)).toBe(false);
		recordAttempt('newest', 60_000);

		expect(present('newest')).toBe(true);
		expect(present('key:0')).toBe(true);
		expect(present('key:1')).toBe(false);
	});
});
