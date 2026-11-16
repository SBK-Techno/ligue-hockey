import { fr, type I18nKey } from '#config/i18n/fr.ts';
import { branding } from '#lib/generated/branding.ts';
import { dateOnlyToDate, toDate } from '#lib/shared/time/clock.ts';

export type { I18nKey };

type Params = Record<string, string | number | undefined>;

export function t(key: I18nKey, params: Params = {}): string {
	const template = fr[key];
	if (template === undefined) {
		return key;
	}
	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = params[name];
		return value === undefined ? match : String(value);
	});
}

const dateLong = new Intl.DateTimeFormat(branding.locale, {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	timeZone: 'UTC'
});

const dateShort = new Intl.DateTimeFormat(branding.locale, {
	day: 'numeric',
	month: 'short',
	timeZone: 'UTC'
});

const dateWithYear = new Intl.DateTimeFormat(branding.locale, {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});

const weekdayFormat = new Intl.DateTimeFormat(branding.locale, {
	weekday: 'long',
	timeZone: 'UTC'
});

const dayMonthFormat = new Intl.DateTimeFormat(branding.locale, {
	day: 'numeric',
	month: 'long',
	timeZone: 'UTC'
});

export function formatWeekday(date: string): string {
	return weekdayFormat.format(dateOnlyToDate(date));
}

export function formatDayMonth(date: string): string {
	return dayMonthFormat.format(dateOnlyToDate(date));
}

export function formatDate(
	date: string,
	style: 'long' | 'short' | 'year' = 'long'
): string {
	const formatter =
		style === 'short' ? dateShort : style === 'year' ? dateWithYear : dateLong;
	return formatter.format(dateOnlyToDate(date));
}

const timestampFormat = new Intl.DateTimeFormat(branding.locale, {
	day: 'numeric',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit',
	timeZone: branding.timezone
});

export function formatTimestamp(ms: number): string {
	return timestampFormat.format(toDate(ms));
}

const monthYearFormat = new Intl.DateTimeFormat(branding.locale, {
	month: 'long',
	year: 'numeric',
	timeZone: branding.timezone
});

export function formatMonthYear(ms: number): string {
	return monthYearFormat.format(toDate(ms));
}

export function formatTime(time: string): string {
	const [hour, minute] = time.split(':');
	const value = Number(hour);
	const unit = t('common.hourShort');
	if (minute === '00') {
		return `${value} ${unit}`;
	}
	return `${value} ${unit} ${minute}`;
}

export function formatDateTime(date: string, time: string): string {
	return `${formatDate(date)} · ${formatTime(time)}`;
}

export function formatMoney(cents: number, currency: string): string {
	return new Intl.NumberFormat(branding.locale, {
		style: 'currency',
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(cents / 100);
}

export function centsToInput(cents: number): string {
	return (cents / 100).toFixed(2);
}

export function parseMoneyToCents(input: string): number | null {
	const normalized = input.trim().replace(/\s/g, '').replace(/\$/g, '').replace(',', '.');

	if (normalized === '' || !/^\d+(\.\d{0,2})?$/.test(normalized)) {
		return null;
	}

	return Math.round(Number(normalized) * 100);
}

export function formatAge(age: number): string {
	return `${age} ${t('common.years')}`;
}

const pluralRules = new Intl.PluralRules(branding.locale);
const decimalFormats = new Map<number, Intl.NumberFormat>();

export function formatCount(count: number, singularKey: I18nKey, pluralKey: I18nKey): string {
	return t(pluralRules.select(count) === 'one' ? singularKey : pluralKey, {
		count
	});
}

export function formatDecimal(value: number, digits: number): string {
	let formatter = decimalFormats.get(digits);
	if (!formatter) {
		formatter = new Intl.NumberFormat(branding.locale, {
			minimumFractionDigits: digits,
			maximumFractionDigits: digits
		});
		decimalFormats.set(digits, formatter);
	}
	return formatter.format(value);
}
