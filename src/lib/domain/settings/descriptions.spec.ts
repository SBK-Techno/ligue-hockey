import { describe, expect, it } from 'vitest';
import {
	defaultSettings,
	SETTINGS,
	SETTINGS_KEYS,
	type SettingsValues
} from '#config/settings-registry.ts';
import { settingDescription, settingsSummary } from './descriptions.ts';

function withSettings(patch: Partial<SettingsValues>): SettingsValues {
	return { ...defaultSettings(), ...patch };
}

describe('settings descriptions', () => {
	it('resolve every placeholder for every documented setting', () => {
		const values = defaultSettings();
		for (const key of SETTINGS_KEYS) {
			if (!SETTINGS[key].descriptionKey) continue;
			expect(settingDescription(key, values), key).not.toMatch(/\{\w+\}/);
		}
	});

	it('derive availability closing time from the configured start time', () => {
		const values = withSettings({
			'games.defaultStartTime': '10:00',
			'games.availabilityClosesHours': 12
		});
		expect(settingDescription('games.availabilityClosesHours', values)).toContain(
			'la veille à 22 h'
		);
	});

	it('derive both substitute notification waves from the configured lead times', () => {
		const values = withSettings({
			'games.defaultStartTime': '10:00',
			'notifications.generalLeadHours': 12,
			'notifications.priorityGapHours': 4
		});
		expect(settingDescription('notifications.generalLeadHours', values)).toContain(
			'la veille à 22 h'
		);
		expect(settingDescription('notifications.priorityGapHours', values)).toContain(
			'la veille à 18 h'
		);
	});

	it('describe multi-day windows instead of mislabelling them as the day before', () => {
		const values = withSettings({
			'games.defaultStartTime': '10:00',
			'notifications.generalLeadHours': 48,
			'notifications.priorityGapHours': 24
		});
		const description = settingDescription('notifications.priorityGapHours', values);
		expect(description).toContain('3 jours avant');
		expect(description).not.toContain('la veille');
	});

	it('derive installment amounts and goalie discount from the live finance settings', () => {
		const values = withSettings({
			'finance.totalCents': 50_000,
			'finance.firstInstallmentPercent': 50,
			'finance.goalieDiscountPercent': 50
		});
		expect(settingDescription('finance.totalCents', values)).toContain('250,00');
		expect(settingDescription('finance.goalieDiscountPercent', values)).toContain(
			'250,00'
		);
		expect(settingDescription('finance.firstInstallmentPercent', values)).toContain(
			'250,00'
		);
	});

	it('derive the minimum roster size for the player cap hint', () => {
		const values = withSettings({
			'roster.forwardsPerTeam': 3,
			'roster.defensePerTeam': 2,
			'roster.goaliesPerTeam': 1
		});
		expect(settingDescription('teams.maxPlayers', values)).toContain(
			'Au moins 12 joueurs'
		);
	});

	it('derive per-match position totals from the roster template', () => {
		const values = withSettings({
			'roster.forwardsPerTeam': 2,
			'roster.defensePerTeam': 2,
			'roster.goaliesPerTeam': 1
		});
		expect(settingDescription('roster.forwardsPerTeam', values)).toContain(
			'4 attaquants'
		);
		expect(settingsSummary(values)).toEqual({
			perTeam: 5,
			totalPlayers: 10,
			forwards: 4,
			defense: 4,
			goalies: 2
		});
	});
});
