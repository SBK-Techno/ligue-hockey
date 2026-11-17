import { describe, expect, it } from 'vitest';
import {
	defaultSettings,
	parseSettings,
	SETTINGS,
	SETTINGS_KEYS,
	settingBound,
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

describe('bornes des réglages numériques', () => {
	const numeric = SETTINGS_KEYS.filter((key) => {
		const kind = SETTINGS[key].kind;
		return kind === 'number' || kind === 'money';
	});

	it('déclare un schéma et des bornes d’interface qui viennent du même nombre', () => {
		expect(numeric.length).toBeGreaterThan(0);
		for (const key of numeric) {
			const definition = SETTINGS[key];
			expect(definition.min, key).toBeTypeOf('number');
			expect(definition.max, key).toBeTypeOf('number');
			expect(definition.step, key).toBeGreaterThan(0);
			expect(definition.min, key).toBeLessThanOrEqual(definition.max!);
			expect(definition.defaultValue, key).toBeGreaterThanOrEqual(definition.min!);
			expect(definition.defaultValue, key).toBeLessThanOrEqual(definition.max!);
			expect(definition.schema.safeParse(definition.min).success, `${key} min`).toBe(true);
			expect(definition.schema.safeParse(definition.max).success, `${key} max`).toBe(true);
			expect(definition.schema.safeParse(definition.min! - 1).success, `${key} min-1`).toBe(
				false
			);
			expect(definition.schema.safeParse(definition.max! + 1).success, `${key} max+1`).toBe(
				false
			);
		}
	});

	it('dérive la fenêtre de notification de la borne déclarée', () => {
		const max = settingBound('notifications.generalLeadHours', 'max');
		const error = errorFor({
			'notifications.generalLeadHours': max,
			'notifications.priorityGapHours': 1
		});
		expect(error.invariantKey).toBe('settings.invariant.notificationWindow');
		expect(() =>
			parseSettings({
				...defaultSettings(),
				'notifications.generalLeadHours': max,
				'notifications.priorityGapHours': 0
			})
		).not.toThrow();
	});
});
