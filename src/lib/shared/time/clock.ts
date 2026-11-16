import { DATE_PATTERN, OFFSET_LOCALE, PART_LOCALE } from '#config/time.ts';

export interface Clock {
	nowMs(): number;
}

export const clock: Clock = {
	nowMs: () => Date.now()
};

export function toDate(ms: number): Date {
	return new Date(ms);
}

export function nowDate(): Date {
	return toDate(clock.nowMs());
}

export function todayInZone(timeZone: string, at: number = clock.nowMs()): string {
	const parts = new Intl.DateTimeFormat(PART_LOCALE, {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(toDate(at));

	const value = Object.fromEntries(
		parts
			.filter((part) => part.type !== 'literal')
			.map((part) => [part.type, part.value])
	);

	return `${value.year}-${value.month}-${value.day}`;
}

export function dateOnlyToDate(date: string): Date {
	const [year, month, day] = date.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day, 12));
}

export function isRealDate(date: string): boolean {
	if (!DATE_PATTERN.test(date)) return false;
	return dateOnlyToDate(date).toISOString().slice(0, 10) === date;
}

function zoneOffsetMs(utcMs: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat(OFFSET_LOCALE, {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	}).formatToParts(toDate(utcMs));

	const value = Object.fromEntries(
		parts
			.filter((part) => part.type !== 'literal')
			.map((part) => [part.type, part.value])
	);

	const asUtc = Date.UTC(
		Number(value.year),
		Number(value.month) - 1,
		Number(value.day),
		Number(value.hour),
		Number(value.minute),
		Number(value.second)
	);

	return asUtc - utcMs;
}

export function zonedDateTimeToMs(
	date: string,
	time: string,
	timeZone: string
): number {
	const [year, month, day] = date.split('-').map(Number);
	const [hour, minute] = time.split(':').map(Number);
	const guess = Date.UTC(year, month - 1, day, hour, minute, 0);

	const firstOffset = zoneOffsetMs(guess, timeZone);
	let result = guess - firstOffset;
	const secondOffset = zoneOffsetMs(result, timeZone);
	if (secondOffset !== firstOffset) {
		result = guess - secondOffset;
	}

	return result;
}

export function addDays(date: string, days: number): string {
	const base = dateOnlyToDate(date);
	base.setUTCDate(base.getUTCDate() + days);
	return base.toISOString().slice(0, 10);
}

export function shiftTime(
	time: string,
	minutes: number
): { time: string; dayOffset: number } {
	const [hour, minute] = time.split(':').map(Number);
	const total = hour * 60 + minute + minutes;
	const dayOffset = Math.floor(total / 1440);
	const normalized = ((total % 1440) + 1440) % 1440;
	const nextHour = Math.floor(normalized / 60);
	const nextMinute = normalized % 60;
	return {
		time: `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`,
		dayOffset
	};
}
