import { addDays, dateOnlyToDate } from '#lib/shared/time/clock.ts';

/**
 * Le mois de l'accueil est celui du prochain match, sinon celui d'aujourd'hui.
 * Le calendrier ne navigue pas : la page de l'horaire possède la navigation.
 */
export type CalendarGame = {
	id: string;
	gameDate: string;
	startTime: string;
	status: string;
	location?: string;
};

export type CalendarDay = {
	date: string;
	dayOfMonth: number;
	inMonth: boolean;
	isToday: boolean;
	isPast: boolean;
	games: CalendarGame[];
	gameCount: number;
	cancelledCount: number;
	hasCancelled: boolean;
};

export type CalendarWeek = CalendarDay[];

export type MonthCalendar = {
	month: string;
	year: number;
	monthNumber: number;
	firstDay: string;
	lastDay: string;
	weeks: CalendarWeek[];
	gameCount: number;
};

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function isMonth(value: string | null | undefined): value is string {
	return value !== null && value !== undefined && MONTH_PATTERN.test(value);
}

function daysInMonth(year: number, month: number): number {
	if (month === 2) {
		const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
		return leap ? 29 : 28;
	}
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function monthFor(nextGameDate: string | null, today: string): string {
	const nextMonth = nextGameDate?.slice(0, 7) ?? null;
	return isMonth(nextMonth) ? nextMonth : today.slice(0, 7);
}

export function buildMonthCalendar(input: {
	games: readonly CalendarGame[];
	today: string;
	nextGameDate?: string | null;
	month?: string;
}): MonthCalendar {
	const month = isMonth(input.month)
		? input.month
		: monthFor(input.nextGameDate ?? null, input.today);
	const year = Number(month.slice(0, 4));
	const monthNumber = Number(month.slice(5, 7));
	const firstDay = `${month}-01`;
	const lastDay = addDays(firstDay, daysInMonth(year, monthNumber) - 1);
	// Monday first: getUTCDay() returns 0 for Sunday.
	const firstWeekday = (dateOnlyToDate(firstDay).getUTCDay() + 6) % 7;
	const weekCount = Math.max(
		5,
		Math.ceil((firstWeekday + daysInMonth(year, monthNumber)) / 7)
	);
	const gridStart = addDays(firstDay, -firstWeekday);

	const gamesByDate = new Map<string, CalendarGame[]>();
	for (const game of input.games) {
		if (!game.gameDate.startsWith(`${month}-`)) continue;
		const rows = gamesByDate.get(game.gameDate) ?? [];
		rows.push(game);
		gamesByDate.set(game.gameDate, rows);
	}

	const weeks: CalendarWeek[] = [];
	let gameCount = 0;
	for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
		const week: CalendarWeek = [];
		for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
			const date = addDays(gridStart, weekIndex * 7 + dayIndex);
			const inMonth = date.startsWith(`${month}-`);
			const games = inMonth ? (gamesByDate.get(date) ?? []) : [];
			if (inMonth) gameCount += games.length;
			const cancelledCount = games.filter((game) => game.status === 'cancelled').length;
			week.push({
				date,
				dayOfMonth: Number(date.slice(8, 10)),
				inMonth,
				isToday: date === input.today,
				isPast: date < input.today,
				games,
				gameCount: games.length,
				cancelledCount,
				hasCancelled: cancelledCount > 0
			});
		}
		weeks.push(week);
	}

	return {
		month,
		year,
		monthNumber,
		firstDay,
		lastDay,
		weeks,
		gameCount
	};
}
