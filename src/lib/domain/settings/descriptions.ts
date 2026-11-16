import { RATING_SCALE } from '#config/rating-attributes.ts';
import {
	SETTINGS,
	type SettingsKey,
	type SettingsValues
} from '#config/settings-registry.ts';
import { TEAMS } from '#config/teams.ts';
import {
	buildSlotDefinitions,
	rosterTemplateFromSettings,
	slotCounts
} from '#config/roster.ts';
import { applyDiscount, splitPlan } from '#lib/domain/finance/plan.ts';
import {
	formatCount,
	formatMoney,
	formatTime,
	t
} from '#lib/shared/i18n/index.ts';
import { shiftTime } from '#lib/shared/time/clock.ts';

type Params = Record<string, string | number>;
type ParamBuilder = (values: SettingsValues) => Params;

function dayRelation(dayOffset: number): string {
	const daysBefore = Math.abs(dayOffset);
	if (daysBefore === 0) return t('common.sameDay');
	if (daysBefore === 1) return t('common.previousDay');
	return t('common.previousDays', { count: daysBefore });
}

function timeParam(values: SettingsValues, minutesFromStart: number) {
	const startTime = values['games.defaultStartTime'];
	const shifted = shiftTime(startTime, -minutesFromStart);
	return {
		startTime: formatTime(startTime),
		time: formatTime(shifted.time),
		dayRelation: dayRelation(shifted.dayOffset)
	};
}

function matchTotal(values: SettingsValues, position: keyof ReturnType<typeof slotCounts>) {
	const template = rosterTemplateFromSettings(values);
	return slotCounts(template)[position] * TEAMS.length;
}

function positionTotal(
	values: SettingsValues,
	position: keyof ReturnType<typeof slotCounts>
): string {
	const count = matchTotal(values, position);
	switch (position) {
		case 'forward':
			return formatCount(count, 'position.forward.one', 'position.forward.many');
		case 'defense':
			return formatCount(count, 'position.defense.one', 'position.defense.many');
		case 'goalie':
			return formatCount(count, 'position.goalie.one', 'position.goalie.many');
	}
}

const PARAMS: Partial<Record<SettingsKey, ParamBuilder>> = {
	'roster.goaliesPerTeam': (values) => ({
		total: positionTotal(values, 'goalie')
	}),
	'roster.forwardsPerTeam': (values) => ({
		total: positionTotal(values, 'forward')
	}),
	'roster.defensePerTeam': (values) => ({
		total: positionTotal(values, 'defense')
	}),
	'games.availabilityClosesHours': (values) =>
		timeParam(values, values['games.availabilityClosesHours'] * 60),
	'notifications.generalLeadHours': (values) =>
		timeParam(values, values['notifications.generalLeadHours'] * 60),
	'notifications.priorityGapHours': (values) => ({
		...timeParam(
			values,
			(values['notifications.generalLeadHours'] +
				values['notifications.priorityGapHours']) *
				60
		),
		gap: values['notifications.priorityGapHours']
	}),
	'notifications.lastCallMinutes': (values) =>
		timeParam(values, values['notifications.lastCallMinutes']),
	'finance.totalCents': (values) => ({
		...splitParams(values),
		total: formatMoney(
			values['finance.totalCents'],
			values['finance.currency']
		)
	}),
	'finance.firstInstallmentPercent': splitParams,
	'finance.goalieDiscountPercent': (values) => ({
		total: formatMoney(
			values['finance.totalCents'],
			values['finance.currency']
		),
		discounted: formatMoney(
			applyDiscount(
				values['finance.totalCents'],
				values['finance.goalieDiscountPercent']
			),
			values['finance.currency']
		)
	}),
	'teams.skillTolerance': () => ({
		min: RATING_SCALE.min,
		max: RATING_SCALE.max
	}),
	'teams.maxPlayers': (values) => ({
		minimum: buildSlotDefinitions(rosterTemplateFromSettings(values)).length
	})
};

function splitParams(values: SettingsValues): Params {
	const plan = splitPlan(
		values['finance.totalCents'],
		values['finance.firstInstallmentPercent']
	);
	return {
		first: formatMoney(plan.firstCents, values['finance.currency']),
		second: formatMoney(plan.secondCents, values['finance.currency'])
	};
}

export function settingDescription(
	key: SettingsKey,
	values: SettingsValues
): string {
	const definition = SETTINGS[key];
	if (!definition.descriptionKey) return '';
	return t(definition.descriptionKey, PARAMS[key]?.(values) ?? {});
}

export type SettingsSummary = {
	perTeam: number;
	totalPlayers: number;
	forwards: number;
	defense: number;
	goalies: number;
};

export function settingsSummary(values: SettingsValues): SettingsSummary {
	const template = rosterTemplateFromSettings(values);
	const counts = slotCounts(template);
	const perTeam = counts.forward + counts.defense + counts.goalie;
	return {
		perTeam,
		totalPlayers: buildSlotDefinitions(template).length,
		forwards: counts.forward * TEAMS.length,
		defense: counts.defense * TEAMS.length,
		goalies: counts.goalie * TEAMS.length
	};
}
