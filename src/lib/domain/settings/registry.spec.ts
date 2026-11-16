import { describe, expect, it } from 'vitest';
import {
	defaultSettings,
	parseSettings,
	SettingsError
} from '#config/settings-registry.ts';

function errorFor(patch: Record<string, unknown>): SettingsError {
	try {
		parseSettings({ ...defaultSettings(), ...patch });
	} catch (cause) {
		expect(cause).toBeInstanceOf(SettingsError);
		return cause as SettingsError;
	}
	throw new Error('Expected settings validation to fail');
}

describe('settings registry invariants', () => {
	it('accepts the defaults', () => {
		expect(() => parseSettings(defaultSettings())).not.toThrow();
	});

	it('rejects a player cap below a full match roster', () => {
		const error = errorFor({ 'teams.maxPlayers': 8 });
		expect(error.invariantKey).toBe('settings.invariant.maxPlayers');
	});

	it('rejects poll limits where the minimum exceeds the maximum', () => {
		const error = errorFor({
			'chat.pollMinOptions': 5,
			'chat.maxPollOptions': 4
		});
		expect(error.invariantKey).toBe('settings.invariant.pollOptions');
	});

	it('rejects an installment order that puts the second payment first', () => {
		const error = errorFor({
			'finance.installment1Due': '2027-03-01',
			'finance.installment2Due': '2026-12-01'
		});
		expect(error.invariantKey).toBe('settings.invariant.installmentDates');
	});
});
