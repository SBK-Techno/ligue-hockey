import { describe, expect, it } from 'vitest';
import { passwordLinkPurpose } from './identity.ts';

const base = 'https://hockey.example/api/auth/reset-password/token';

function link(callback: string): string {
	return `${base}?callbackURL=${encodeURIComponent(callback)}`;
}

describe('password link purpose', () => {
	it('detects an invitation link', () => {
		expect(
			passwordLinkPurpose(
				link('https://hockey.example/reinitialiser-mot-de-passe?mode=invitation')
			)
		).toBe('invitation');
	});

	it('treats an explicit reset link as a reset', () => {
		expect(
			passwordLinkPurpose(
				link('https://hockey.example/reinitialiser-mot-de-passe?mode=reset')
			)
		).toBe('reset');
	});

	it('defaults to reset for legacy links without a mode', () => {
		expect(
			passwordLinkPurpose(
				link('https://hockey.example/reinitialiser-mot-de-passe')
			)
		).toBe('reset');
	});

	it('defaults to reset for malformed links', () => {
		expect(passwordLinkPurpose('not-a-url')).toBe('reset');
		expect(passwordLinkPurpose(`${base}?callbackURL=%%%`)).toBe('reset');
	});
});
