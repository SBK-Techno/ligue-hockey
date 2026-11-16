import { describe, expect, it } from 'vitest';
import { errorStatus } from './error-status.ts';

describe('server error status', () => {
	it('keeps the status of a SvelteKit app error', () => {
		expect(errorStatus('app', 403)).toBe(403);
	});

	it('keeps framework and validation statuses', () => {
		expect(errorStatus('framework', 404)).toBe(404);
		expect(errorStatus('validation', 400)).toBe(400);
	});

	it('keeps the status carried by an AppError', () => {
		expect(errorStatus('unknown', undefined, 403)).toBe(403);
	});

	it('falls back to 500 for an unknown error without a status', () => {
		expect(errorStatus('unknown', undefined)).toBe(500);
	});

	it('does not turn a missing app status into success', () => {
		expect(errorStatus('app', undefined)).toBe(500);
	});
});
