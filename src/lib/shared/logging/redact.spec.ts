import { describe, expect, it } from 'vitest';
import { redactPath, sanitize } from './redact.ts';

describe('log redaction', () => {
	it('removes a password-reset token from the logged path', () => {
		expect(redactPath('/api/auth/reset-password/secret-token')).toBe(
			'/api/auth/reset-password/[redacted]'
		);
	});

	it('leaves ordinary paths intact', () => {
		expect(redactPath('/matchs/game_123')).toBe('/matchs/game_123');
	});

	it('redacts sensitive keys at every depth', () => {
		expect(
			sanitize({ password: 'secret', nested: { sessionToken: 'abc', safe: 'ok' } }, true)
		).toEqual({
			password: '[redacted]',
			nested: { sessionToken: '[redacted]', safe: 'ok' }
		});
	});

	it('redacts reset tokens in nested path fields', () => {
		expect(sanitize({ request: { path: '/api/auth/reset-password/secret' } }, true)).toEqual({
			request: { path: '/api/auth/reset-password/[redacted]' }
		});
	});

	it('omits stack traces in production', () => {
		const result = sanitize(new Error('boom'), false) as { stack?: string };
		expect(result.stack).toBeUndefined();
	});

	it('keeps stack traces outside production', () => {
		const result = sanitize(new Error('boom'), true) as { stack?: string };
		expect(typeof result.stack).toBe('string');
	});

	it('marks circular references', () => {
		const value: Record<string, unknown> = {};
		value.self = value;
		expect(sanitize(value, true)).toEqual({ self: '[circular]' });
	});

	it('does not mutate the input', () => {
		const input = { path: '/matchs/game_123', password: 'secret' };
		sanitize(input, true);
		expect(input).toEqual({ path: '/matchs/game_123', password: 'secret' });
	});
});
