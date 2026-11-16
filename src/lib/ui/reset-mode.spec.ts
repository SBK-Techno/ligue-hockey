import { describe, expect, it } from 'vitest';
import {
	resetLeadKey,
	resetMode,
	resetSuccessPath,
	resetSuccessKey,
	resetTitleKey
} from './reset-mode.ts';

describe('reset page mode', () => {
	it.each([
		['invite', 'invite'],
		['reset', 'reset'],
		[null, 'reset'],
		['unknown', 'reset']
	] as const)('reads ?mode=%s as %s', (value, expected) => {
		expect(resetMode(value)).toBe(expected);
	});

	it.each([
		['invite', 'invite.title', 'invite.lead', 'invite.success'],
		['reset', 'auth.reset.chooseTitle', 'auth.reset.chooseLead', 'auth.reset.success']
	] as const)('branches %s copy', (mode, title, lead, success) => {
		expect(resetTitleKey(mode)).toBe(title);
		expect(resetLeadKey(mode)).toBe(lead);
		expect(resetSuccessKey(mode)).toBe(success);
	});

	it('carries the mode to the login confirmation', () => {
		expect(resetSuccessPath('invite')).toBe('/connexion?reinitialise=1&mode=invite');
		expect(resetSuccessPath('reset')).toBe('/connexion?reinitialise=1&mode=reset');
	});
});
