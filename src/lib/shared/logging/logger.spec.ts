import { describe, expect, it } from 'vitest';
import { redactPath } from './logger.ts';

describe('log path redaction', () => {
	it('removes a password-reset token from the logged path', () => {
		expect(redactPath('/api/auth/reset-password/secret-token')).toBe(
			'/api/auth/reset-password/[redacted]'
		);
	});

	it('leaves ordinary paths intact', () => {
		expect(redactPath('/matchs/game_123')).toBe('/matchs/game_123');
	});
});
