import { describe, expect, it } from 'vitest';
import { branding } from '#lib/generated/branding.ts';
import { zonedDateTimeToMs } from '#lib/shared/time/clock.ts';
import {
	defaultGameDraft,
	nextGameId,
	nextLeagueDay,
	splitSchedule,
	type ScheduleGame
} from './schedule.ts';

const at = (date: string, time: string) =>
	zonedDateTimeToMs(date, time, branding.timezone);

const game = (
	id: string,
	gameDate: string,
	startTime: string,
	status: ScheduleGame['status'] = 'scheduled'
): ScheduleGame => ({ id, gameDate, startTime, status });

describe('splitSchedule', () => {
	const cases = [
		{
			name: 'a 19:00 game is still upcoming at 09:00',
			now: at('2026-11-16', '09:00'),
			game: game('g', '2026-11-16', '19:00'),
			expected: 'upcoming'
		},
		{
			name: 'a 19:00 game is still upcoming just before its start',
			now: at('2026-11-16', '18:59'),
			game: game('g', '2026-11-16', '19:00'),
			expected: 'upcoming'
		},
		{
			name: 'a 19:00 game is past just after its start',
			now: at('2026-11-16', '19:01'),
			game: game('g', '2026-11-16', '19:00'),
			expected: 'past'
		},
		{
			name: 'the same 19:00 game is past at 23:00',
			now: at('2026-11-16', '23:00'),
			game: game('g', '2026-11-16', '19:00'),
			expected: 'past'
		},
		{
			name: 'a cancelled game before its start stays visible',
			now: at('2026-11-16', '09:00'),
			game: game('g', '2026-11-16', '19:00', 'cancelled'),
			expected: 'upcoming'
		},
		{
			name: 'a cancelled game after its start moves to the archive',
			now: at('2026-11-16', '23:00'),
			game: game('g', '2026-11-16', '19:00', 'cancelled'),
			expected: 'past'
		},
		{
			name: 'a completed future game is never lost',
			now: at('2026-11-16', '09:00'),
			game: game('g', '2026-11-23', '19:00', 'completed'),
			expected: 'past'
		}
	] as const;

	for (const entry of cases) {
		it(entry.name, () => {
			const split = splitSchedule([entry.game], entry.now);
			expect(split[entry.expected].map((row) => row.id)).toEqual(['g']);
		});
	}
});

describe('nextGameId', () => {
	const now = at('2026-11-16', '09:00');

	it('skips a cancelled first game', () => {
		expect(
			nextGameId(
				[
					game('cancelled', '2026-11-16', '10:00', 'cancelled'),
					game('scheduled', '2026-11-16', '19:00')
				],
				now
			)
		).toBe('scheduled');
	});

	it('ignores a game that already started', () => {
		expect(
			nextGameId(
				[game('started', '2026-11-16', '08:00'), game('later', '2026-11-17', '19:00')],
				now
			)
		).toBe('later');
	});

	it('returns null without a scheduled game', () => {
		expect(nextGameId([game('cancelled', '2026-11-16', '19:00', 'cancelled')], now)).toBe(null);
	});
});

describe('nextLeagueDay', () => {
	it('moves to the next Sunday, never today', () => {
		expect(nextLeagueDay('2026-11-16')).toBe('2026-11-22');
		expect(nextLeagueDay('2026-11-22')).toBe('2026-11-29');
	});
});

describe('defaultGameDraft', () => {
	const locations = [
		{ id: 'arena-a', name: 'Aréna A' },
		{ id: 'arena-b', name: 'Aréna B' }
	];
	const now = at('2026-11-16', '09:00');

	it('uses the nearest played game, never the furthest future', () => {
		const draft = defaultGameDraft({
			games: [
				{ ...game('past', '2026-11-15', '08:00'), locationId: 'arena-a' },
				{ ...game('future', '2026-11-23', '20:00'), locationId: 'arena-b' }
			],
			locations,
			defaultLocationName: 'Aréna B',
			defaultStartTime: '09:00',
			today: '2026-11-16',
			at: now
		});
		expect(draft.time).toBe('08:00');
		expect(draft.locationId).toBe('arena-a');
	});

	it('falls back to the next game when nothing was played', () => {
		const draft = defaultGameDraft({
			games: [{ ...game('future', '2026-11-23', '20:00'), locationId: 'arena-b' }],
			locations,
			defaultLocationName: 'Aréna A',
			defaultStartTime: '09:00',
			today: '2026-11-16',
			at: now
		});
		expect(draft.time).toBe('20:00');
		expect(draft.locationId).toBe('arena-b');
	});

	it('skips a cancelled finale and resolves the configured name once', () => {
		const draft = defaultGameDraft({
			games: [
				{ ...game('played', '2026-11-15', '08:00'), locationId: 'arena-a' },
				{ ...game('finale', '2026-11-22', '21:00', 'cancelled'), locationId: 'arena-b' }
			],
			locations,
			defaultLocationName: 'Aréna B',
			defaultStartTime: '09:00',
			today: '2026-11-16',
			at: now
		});
		expect(draft.time).toBe('08:00');
		expect(draft.locationId).toBe('arena-a');
	});

	it('uses the settings when the schedule is empty', () => {
		const draft = defaultGameDraft({
			games: [],
			locations,
			defaultLocationName: 'Aréna B',
			defaultStartTime: '07:30',
			today: '2026-11-16',
			at: now
		});
		expect(draft).toEqual({
			date: '2026-11-22',
			time: '07:30',
			locationId: 'arena-b'
		});
	});
});
