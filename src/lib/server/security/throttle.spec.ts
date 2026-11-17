import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	MAX_BUCKETS,
	clearAttempts,
	consumeAttempt,
	resetThrottle,
	throttleSize
} from './throttle.ts';

beforeEach(() => {
	resetThrottle();
	vi.useFakeTimers();
	vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 0, 0));
});

afterEach(() => {
	vi.useRealTimers();
});

/** Une clé déjà consommée refuse une nouvelle tentative avec une limite de 1. */
function present(key: string): boolean {
	return !consumeAttempt(key, 1, 60_000);
}

describe('auth throttle', () => {
	it('blocks once the limit is reached and clears on success', () => {
		const key = 'test:login';
		expect(consumeAttempt(key, 2, 60_000)).toBe(true);
		expect(consumeAttempt(key, 2, 60_000)).toBe(true);
		expect(consumeAttempt(key, 2, 60_000)).toBe(false);
		clearAttempts(key);
		expect(consumeAttempt(key, 2, 60_000)).toBe(true);
	});

	it('réserve atomiquement le plafond, même en rafale parallèle', async () => {
		const key = 'burst:login';
		const results = await Promise.all(
			Array.from({ length: 20 }, async () => consumeAttempt(key, 5, 60_000))
		);

		expect(results.filter(Boolean)).toHaveLength(5);
		expect(results.filter((allowed) => !allowed)).toHaveLength(15);
		expect(consumeAttempt(key, 5, 60_000)).toBe(false);
	});

	it('borne le registre et garde la clé la plus récente', () => {
		for (let index = 0; index < 20_000; index += 1) {
			consumeAttempt(`unique:${index}`, 1, 60_000);
		}

		expect(MAX_BUCKETS).toBe(10_000);
		expect(throttleSize()).toBe(MAX_BUCKETS);
		expect(present('unique:19999')).toBe(true);
		expect(present('unique:0')).toBe(false);
	});

	it('évince les clés expirées avant les clés vivantes', () => {
		for (let index = 0; index < MAX_BUCKETS; index += 1) {
			consumeAttempt(`short:${index}`, 1, 1_000);
		}
		vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 0, 5));

		consumeAttempt('fresh', 1, 60_000);

		expect(present('fresh')).toBe(true);
		expect(present('short:0')).toBe(false);
	});

	it('rafraîchit la clé à chaque tentative et garde les plus actives', () => {
		for (let index = 0; index < MAX_BUCKETS; index += 1) {
			consumeAttempt(`key:${index}`, 2, 60_000);
		}
		// La clé la plus ancienne redevient récente par une lecture, puis une
		// nouvelle clé force l'éviction d'une autre.
		expect(consumeAttempt('key:0', 2, 60_000)).toBe(true);
		consumeAttempt('newest', 1, 60_000);

		expect(present('newest')).toBe(true);
		expect(present('key:0')).toBe(true);
		expect(present('key:1')).toBe(false);
	});
});
