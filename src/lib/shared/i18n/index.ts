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

/** Une date qui ouvre une section : la majuscule vient du formateur, pas de la vue. */
export function formatDateHeading(date: string): string {
	const label = formatDate(date, 'long');
	return label.charAt(0).toLocaleUpperCase(branding.locale) + label.slice(1);
}

const weekdayShortFormat = new Intl.DateTimeFormat(branding.locale, {
	weekday: 'short',
	timeZone: branding.timezone
});

export function formatWeekdayShort(date: string): string {
	return weekdayShortFormat.format(dateOnlyToDate(date));
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

const timeOfDayFormat = new Intl.DateTimeFormat(branding.locale, {
	hour: '2-digit',
	minute: '2-digit',
	timeZone: branding.timezone
});

/** L'heure seule, quand le jour est déjà écrit au-dessus. */
export function formatTimeOfDay(ms: number): string {
	return timeOfDayFormat.format(toDate(ms));
}

const monthYearFormat = new Intl.DateTimeFormat(branding.locale, {
	month: 'long',
	year: 'numeric',
	timeZone: branding.timezone
});

const monthLabelFormat = new Intl.DateTimeFormat(branding.locale, {
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});

export function formatMonthYear(ms: number): string {
	return monthYearFormat.format(toDate(ms));
}

/** Un mois de calendrier `YYYY-MM`, sans dépendre du fuseau du serveur. */
export function formatMonthLabel(month: string): string {
	return monthLabelFormat.format(dateOnlyToDate(`${month}-01`));
}

export function formatTimeParts(time: string): { hour: string; minute: string } {
	const [hour, minute] = time.split(':');
	return { hour: String(Number(hour)), minute: minute ?? '00' };
}

export function formatTime(time: string): string {
	const { hour, minute } = formatTimeParts(time);
	const unit = t('common.hourShort');
	// Espace fine insécable : « 20 h 30 » ne se coupe pas à 320 px.
	if (minute === '00') {
		return `${hour}\u202F${unit}`;
	}
	return `${hour}\u202F${unit}\u202F${minute}`;
}

export function formatDateTime(date: string, time: string): string {
	return `${formatDate(date)} · ${formatTime(time)}`;
}

const currencySymbolFormats = new Map<string, Intl.NumberFormat>();

export function currencySymbol(currency: string): string {
	let formatter = currencySymbolFormats.get(currency);
	if (!formatter) {
		formatter = new Intl.NumberFormat(branding.locale, {
			style: 'currency',
			currency
		});
		currencySymbolFormats.set(currency, formatter);
	}
	const parts = formatter.formatToParts(0);
	return parts.find((part) => part.type === 'currency')?.value ?? currency;
}

const moneyFormats = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: number, currency: string): string {
	let formatter = moneyFormats.get(currency);
	if (!formatter) {
		formatter = new Intl.NumberFormat(branding.locale, {
			style: 'currency',
			currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
		moneyFormats.set(currency, formatter);
	}
	return formatter.format(cents / 100);
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

export function formatCount(
	count: number,
	singularKey: I18nKey,
	pluralKey: I18nKey,
	params: Params = {}
): string {
	return t(pluralRules.select(count) === 'one' ? singularKey : pluralKey, {
		count,
		...params
	});
}

const percentFormat = new Intl.NumberFormat(branding.locale, {
	style: 'percent',
	maximumFractionDigits: 0
});

/** Une part entière, jamais un faux décimal : 0,34 devient 34 %. */
export function formatPercent(part: number, whole: number): string {
	if (whole <= 0) return percentFormat.format(0);
	return percentFormat.format(part / whole);
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
