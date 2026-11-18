import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFSET_LOCALE, PART_LOCALE } from '#config/time.ts';
import { timeInZone, todayInZone, toDate, zonedDateTimeToMs } from './clock.ts';

/**
 * La date et l'heure de la ligue sortent d'un seul convertisseur. Minuit ne
 * doit jamais devenir `24:00` dans une comparaison SQL ou un formulaire.
 */
describe('heure de la ligue', () => {
	const zone = 'America/Toronto';

	it('rend la date locale au passage de minuit UTC', () => {
		// 2026-11-17 03:30 UTC = 2026-11-16 22:30 à Toronto.
		expect(todayInZone(zone, Date.UTC(2026, 10, 17, 3, 30))).toBe('2026-11-16');
	});

	it('rend l’heure locale sur 24 heures', () => {
		expect(timeInZone(zone, Date.UTC(2026, 10, 17, 3, 30))).toBe('22:30');
	});

	it('ramène minuit à 00:00, jamais 24:00', () => {
		// 2026-11-17 05:00 UTC = 2026-11-17 00:00 à Toronto (EST).
		expect(timeInZone(zone, Date.UTC(2026, 10, 17, 5, 0))).toBe('00:00');
	});
});

/**
 * Reference oracle: the pre-cache implementation, constructing a fresh
 * Intl.DateTimeFormat on every call. The cached helpers must stay
 * byte-for-byte identical to it for every input.
 */
function referenceParts(
	locale: string,
	timeZone: string,
	at: number,
	options: Intl.DateTimeFormatOptions
): Record<string, string> {
	const parts = new Intl.DateTimeFormat(locale, { ...options, timeZone }).formatToParts(
		toDate(at)
	);
	return Object.fromEntries(
		parts
			.filter((part) => part.type !== 'literal')
			.map((part) => [part.type, part.value])
	);
}

function referenceToday(timeZone: string, at: number): string {
	const value = referenceParts(PART_LOCALE, timeZone, at, {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	return `${value.year}-${value.month}-${value.day}`;
}

function referenceTime(timeZone: string, at: number): string {
	const parts = new Intl.DateTimeFormat(PART_LOCALE, {
		timeZone,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).formatToParts(toDate(at));
	const rawHour = parts.find((part) => part.type === 'hour')?.value ?? '00';
	const hour = rawHour === '24' ? '00' : rawHour;
	const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
	return `${hour}:${minute}`;
}

function referenceZonedToMs(date: string, time: string, timeZone: string): number {
	const [year, month, day] = date.split('-').map(Number);
	const [hour, minute] = time.split(':').map(Number);
	const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
	const offsetAt = (utcMs: number): number => {
		const value = referenceParts(OFFSET_LOCALE, timeZone, utcMs, {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
		return (
			Date.UTC(
				Number(value.year),
				Number(value.month) - 1,
				Number(value.day),
				Number(value.hour),
				Number(value.minute),
				Number(value.second)
			) - utcMs
		);
	};
	const firstOffset = offsetAt(guess);
	let result = guess - firstOffset;
	const secondOffset = offsetAt(result);
	if (secondOffset !== firstOffset) {
		result = guess - secondOffset;
	}
	return result;
}

const zones = [
	'America/Toronto',
	'America/St_Johns',
	'UTC',
	'Asia/Kolkata',
	'Australia/Sydney',
	'Pacific/Kiritimati'
];

/** UTC instants around the 2026 DST transitions of the sampled zones, plus edges. */
const instants = [
	0,
	Date.UTC(1969, 6, 20, 20, 17),
	// Toronto spring forward: 2026-03-08 07:00 UTC.
	Date.UTC(2026, 2, 8, 6, 59),
	Date.UTC(2026, 2, 8, 7, 0),
	// Toronto fall back: 2026-11-01 06:00 UTC.
	Date.UTC(2026, 10, 1, 5, 59),
	Date.UTC(2026, 10, 1, 6, 0),
	Date.UTC(2026, 10, 1, 6, 59),
	// St_Johns transitions: 05:30 and 04:30 UTC.
	Date.UTC(2026, 2, 8, 5, 29),
	Date.UTC(2026, 2, 8, 5, 30),
	Date.UTC(2026, 10, 1, 4, 29),
	Date.UTC(2026, 10, 1, 4, 30),
	// Sydney transitions: 2026-04-04 and 2026-10-03 at 16:00 UTC.
	Date.UTC(2026, 3, 4, 15, 59),
	Date.UTC(2026, 3, 4, 16, 0),
	Date.UTC(2026, 9, 3, 15, 59),
	Date.UTC(2026, 9, 3, 16, 0),
	Date.UTC(2026, 10, 17, 3, 30),
	Date.UTC(2100, 0, 1, 0, 0)
];

describe('cached formatters match fresh construction', () => {
	it.each(zones)('todayInZone and timeInZone stay identical at every sampled instant in %s', (zone) => {
		for (const at of instants) {
			expect(todayInZone(zone, at)).toBe(referenceToday(zone, at));
			expect(timeInZone(zone, at)).toBe(referenceTime(zone, at));
		}
	});

	it.each(zones)('a year of daily samples stays identical in %s', (zone) => {
		for (let day = 0; day < 365; day += 5) {
			for (const hour of [4, 16]) {
				const at = Date.UTC(2026, 0, 1 + day, hour, 45);
				expect(todayInZone(zone, at)).toBe(referenceToday(zone, at));
				expect(timeInZone(zone, at)).toBe(referenceTime(zone, at));
			}
		}
	});

	it.each(zones)('zonedDateTimeToMs keeps the two-pass offset result in %s', (zone) => {
		const dates = ['2026-01-15', '2026-03-08', '2026-06-15', '2026-10-04', '2026-11-01', '2026-12-31'];
		const times = ['00:00', '01:30', '02:30', '12:00', '23:59'];
		for (const date of dates) {
			for (const time of times) {
				expect(zonedDateTimeToMs(date, time, zone)).toBe(referenceZonedToMs(date, time, zone));
			}
		}
	});
});

describe('DST boundaries keep exact local values', () => {
	const zone = 'America/Toronto';

	it('spring forward skips 02:00 without shifting the date', () => {
		expect(todayInZone(zone, Date.UTC(2026, 2, 8, 6, 59))).toBe('2026-03-08');
		expect(timeInZone(zone, Date.UTC(2026, 2, 8, 6, 59))).toBe('01:59');
		expect(timeInZone(zone, Date.UTC(2026, 2, 8, 7, 0))).toBe('03:00');
	});

	it('fall back repeats 01:00 on the same date', () => {
		expect(timeInZone(zone, Date.UTC(2026, 10, 1, 5, 59))).toBe('01:59');
		expect(timeInZone(zone, Date.UTC(2026, 10, 1, 6, 0))).toBe('01:00');
		expect(timeInZone(zone, Date.UTC(2026, 10, 1, 6, 59))).toBe('01:59');
		expect(todayInZone(zone, Date.UTC(2026, 10, 1, 6, 59))).toBe('2026-11-01');
	});

	it('zonedDateTimeToMs keeps the exact offset math across the gap and the fold', () => {
		expect(zonedDateTimeToMs('2026-03-08', '01:59', zone)).toBe(Date.UTC(2026, 2, 8, 6, 59));
		expect(zonedDateTimeToMs('2026-03-08', '03:00', zone)).toBe(Date.UTC(2026, 2, 8, 7, 0));
		// The nonexistent 02:30 keeps the historical two-pass result: 01:30 EST.
		expect(zonedDateTimeToMs('2026-03-08', '02:30', zone)).toBe(Date.UTC(2026, 2, 8, 6, 30));
		// The ambiguous 01:30 resolves to the first occurrence (EDT).
		expect(zonedDateTimeToMs('2026-11-01', '01:30', zone)).toBe(Date.UTC(2026, 10, 1, 5, 30));
		expect(zonedDateTimeToMs('2026-11-01', '02:00', zone)).toBe(Date.UTC(2026, 10, 1, 7, 0));
	});

	it('half-hour and +14 zones convert exactly', () => {
		expect(zonedDateTimeToMs('2026-06-15', '12:00', 'Asia/Kolkata')).toBe(Date.UTC(2026, 5, 15, 6, 30));
		expect(zonedDateTimeToMs('2026-06-15', '12:00', 'America/St_Johns')).toBe(Date.UTC(2026, 5, 15, 14, 30));
		expect(zonedDateTimeToMs('2026-01-15', '12:00', 'America/St_Johns')).toBe(Date.UTC(2026, 0, 15, 15, 30));
		expect(zonedDateTimeToMs('2026-06-15', '12:00', 'Pacific/Kiritimati')).toBe(Date.UTC(2026, 5, 14, 22, 0));
	});

	it('round-trips unambiguous local times through the reused formatters', () => {
		const cases: Array<[string, string, string]> = [
			['America/Toronto', '2026-03-08', '01:59'],
			['America/Toronto', '2026-03-08', '03:00'],
			['America/Toronto', '2026-11-01', '02:00'],
			['America/St_Johns', '2026-03-08', '03:00'],
			['Australia/Sydney', '2026-04-05', '03:00'],
			['Australia/Sydney', '2026-10-04', '03:00'],
			['Asia/Kolkata', '2026-06-15', '12:00'],
			['Pacific/Kiritimati', '2026-12-31', '23:59']
		];
		for (const [zone, date, time] of cases) {
			const ms = zonedDateTimeToMs(date, time, zone);
			expect(todayInZone(zone, ms)).toBe(date);
			expect(timeInZone(zone, ms)).toBe(time);
		}
	});
});

describe('invalid timezones keep throwing on every call', () => {
	it('never caches a failed construction', () => {
		for (let i = 0; i < 3; i++) {
			expect(() => todayInZone('Mars/Olympus', 0)).toThrow(RangeError);
			expect(() => timeInZone('Mars/Olympus', 0)).toThrow(RangeError);
			expect(() => zonedDateTimeToMs('2026-06-15', '12:00', 'Mars/Olympus')).toThrow(RangeError);
		}
	});
});

/**
 * Regression: the formatters must be constructed once per timezone and
 * option shape, never once per call. These zones are used nowhere else in
 * this file so the counts start from a cold cache. Before the fix every
 * call constructed a new Intl.DateTimeFormat and these counts failed.
 */
describe('formatter construction is cached per timezone and shape', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('todayInZone builds one formatter per timezone, not per call', () => {
		const spy = vi.spyOn(Intl, 'DateTimeFormat');
		const base = Date.UTC(2026, 5, 15, 12);
		for (let i = 0; i < 200; i++) todayInZone('Pacific/Chatham', base + i * 60_000);
		expect(spy).toHaveBeenCalledTimes(1);
		for (let i = 0; i < 200; i++) todayInZone('Pacific/Chatham', base + i * 3_600_000);
		expect(spy).toHaveBeenCalledTimes(1);
		todayInZone('Antarctica/Troll', base);
		expect(spy).toHaveBeenCalledTimes(2);
		todayInZone('Pacific/Chatham', base);
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it('timeInZone builds one formatter per timezone, not per call', () => {
		const spy = vi.spyOn(Intl, 'DateTimeFormat');
		const base = Date.UTC(2026, 5, 15, 12);
		for (let i = 0; i < 200; i++) timeInZone('Pacific/Marquesas', base + i * 60_000);
		expect(spy).toHaveBeenCalledTimes(1);
		timeInZone('Asia/Kathmandu', base);
		expect(spy).toHaveBeenCalledTimes(2);
		timeInZone('Pacific/Marquesas', base);
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it('zonedDateTimeToMs builds one offset formatter per timezone despite two lookups', () => {
		const spy = vi.spyOn(Intl, 'DateTimeFormat');
		for (let i = 0; i < 50; i++) {
			zonedDateTimeToMs(i % 2 === 0 ? '2026-01-15' : '2026-07-15', i % 2 === 0 ? '09:00' : '20:30', 'Australia/Lord_Howe');
		}
		expect(spy).toHaveBeenCalledTimes(1);
		zonedDateTimeToMs('2026-06-15', '12:00', 'Pacific/Apia');
		expect(spy).toHaveBeenCalledTimes(2);
		zonedDateTimeToMs('2026-06-15', '12:00', 'Australia/Lord_Howe');
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it('the date, time and offset shapes never share a cache entry', () => {
		const spy = vi.spyOn(Intl, 'DateTimeFormat');
		const base = Date.UTC(2026, 5, 15, 12);
		todayInZone('America/Sao_Paulo', base);
		timeInZone('America/Sao_Paulo', base);
		zonedDateTimeToMs('2026-06-15', '12:00', 'America/Sao_Paulo');
		expect(spy).toHaveBeenCalledTimes(3);
		todayInZone('America/Sao_Paulo', base);
		timeInZone('America/Sao_Paulo', base);
		zonedDateTimeToMs('2026-06-15', '12:00', 'America/Sao_Paulo');
		expect(spy).toHaveBeenCalledTimes(3);
	});
});
