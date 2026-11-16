import { describe, expect, it } from 'vitest';
import { dateOnlyToDate } from '#lib/shared/time/clock.ts';
import { buildMonthCalendar, monthFor, type CalendarGame } from './calendar.ts';

const today = '2026-11-16';

const games: CalendarGame[] = [
	{ id: 'past', gameDate: '2026-11-01', startTime: '09:00', status: 'scheduled' },
	{ id: 'double-1', gameDate: '2026-11-22', startTime: '09:00', status: 'scheduled' },
	{
		id: 'double-2',
		gameDate: '2026-11-22',
		startTime: '11:00',
		status: 'cancelled',
		location: 'Aréna'
	},
	{ id: 'next-week', gameDate: '2026-11-29', startTime: '09:00', status: 'scheduled' },
	{ id: 'outside', gameDate: '2026-12-06', startTime: '09:00', status: 'scheduled' }
];

function day(calendar: ReturnType<typeof buildMonthCalendar>, date: string) {
	return calendar.weeks.flat().find((entry) => entry.date === date);
}

describe('mois du calendrier', () => {
	it('prend le mois du prochain match, sinon le mois courant', () => {
		expect(monthFor('2027-01-10', today)).toBe('2027-01');
		expect(monthFor(null, today)).toBe('2026-11');
		expect(monthFor('pas-une-date', today)).toBe('2026-11');
	});
});

describe('table du mois', () => {
	it('commence le lundi et couvre le mois en 5 ou 6 semaines', () => {
		const calendar = buildMonthCalendar({ games, today, nextGameDate: '2026-11-22' });

		expect(calendar.month).toBe('2026-11');
		expect(calendar.firstDay).toBe('2026-11-01');
		expect(calendar.lastDay).toBe('2026-11-30');
		expect(calendar.weeks.length).toBeGreaterThanOrEqual(5);
		expect(calendar.weeks.length).toBeLessThanOrEqual(6);
		for (const week of calendar.weeks) {
			expect(week).toHaveLength(7);
			expect(dateOnlyToDate(week[0].date).getUTCDay()).toBe(1);
		}
		expect(calendar.weeks[0][0].date).toBe('2026-10-26');
		expect(calendar.weeks[0][6].date).toBe('2026-11-01');
		expect(calendar.weeks[0][6].inMonth).toBe(true);
	});

	it('gère une année bissextile et un mois sans match', () => {
		const leap = buildMonthCalendar({ games: [], today: '2028-02-15', month: '2028-02' });
		expect(leap.lastDay).toBe('2028-02-29');
		expect(day(leap, '2028-02-29')?.inMonth).toBe(true);
		expect(leap.gameCount).toBe(0);

		const short = buildMonthCalendar({ games: [], today: '2027-02-15', month: '2027-02' });
		expect(short.lastDay).toBe('2027-02-28');
		expect(short.weeks.length).toBe(5);
	});

	it('gère les bornes du mois et les jours voisins', () => {
		const january = buildMonthCalendar({ games: [], today: '2027-01-15', month: '2027-01' });
		expect(january.weeks[0][0].date).toBe('2026-12-28');
		expect(january.weeks[0][0].inMonth).toBe(false);
		expect(january.weeks.at(-1)?.at(-1)?.date).toBe('2027-01-31');
	});

	it('marque aujourd’hui une seule fois et distingue le passé', () => {
		const calendar = buildMonthCalendar({ games, today, nextGameDate: '2026-11-22' });
		const todayCells = calendar.weeks.flat().filter((entry) => entry.isToday);

		expect(todayCells).toHaveLength(1);
		expect(todayCells[0].date).toBe(today);
		expect(day(calendar, '2026-11-15')?.isPast).toBe(true);
		expect(day(calendar, '2026-11-17')?.isPast).toBe(false);
		expect(day(calendar, '2026-11-01')?.isPast).toBe(true);
	});

	it('compte les matchs multiples et marque une annulation', () => {
		const calendar = buildMonthCalendar({ games, today, nextGameDate: '2026-11-22' });
		const double = day(calendar, '2026-11-22');

		expect(double?.gameCount).toBe(2);
		expect(double?.hasCancelled).toBe(true);
		expect(double?.games.map((game) => game.id)).toEqual(['double-1', 'double-2']);
		expect(calendar.gameCount).toBe(4);
	});

	it('ignore les matchs des jours voisins et d’un autre mois', () => {
		const calendar = buildMonthCalendar({ games, today, nextGameDate: '2026-11-22' });
		const outside = day(calendar, '2026-12-06');

		expect(outside?.inMonth).toBe(false);
		expect(outside?.gameCount).toBe(0);
		expect(outside?.games).toEqual([]);
	});

	it('ne marque aucun match quand l’horaire est vide', () => {
		const calendar = buildMonthCalendar({ games: [], today });

		expect(calendar.month).toBe('2026-11');
		expect(calendar.gameCount).toBe(0);
		expect(calendar.weeks.flat().every((entry) => entry.gameCount === 0)).toBe(true);
	});
});
