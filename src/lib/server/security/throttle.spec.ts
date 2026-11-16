import { describe, expect, it } from 'vitest';
import {
	clearAttempts,
	recordAttempt,
	tooManyAttempts
} from './throttle.ts';

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
});
