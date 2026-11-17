import type { I18nKey } from './i18n/fr.ts';

export type PeriodDefinition = {
	number: number;
	labelKey: I18nKey;
	overtime: boolean;
};

/** Les trois périodes réglementaires et la prolongation. */
export const PERIODS = [
	{ number: 1, labelKey: 'period.first', overtime: false },
	{ number: 2, labelKey: 'period.second', overtime: false },
	{ number: 3, labelKey: 'period.third', overtime: false },
	{ number: 4, labelKey: 'period.overtime', overtime: true }
] as const satisfies readonly PeriodDefinition[];

export type Period = (typeof PERIODS)[number]['number'];

export const PERIOD_NUMBERS = [1, 2, 3, 4] as const;

export function isPeriod(value: number): value is Period {
	return PERIOD_NUMBERS.includes(value as Period);
}

export function periodDefinition(period: Period) {
	const definition = PERIODS.find((entry) => entry.number === period);
	if (!definition) {
		throw new Error(`Unknown period: ${period}`);
	}
	return definition;
}
