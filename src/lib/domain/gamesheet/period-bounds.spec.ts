import { describe, expect, it } from 'vitest';
import { GOAL_KIND_KEYS } from '#config/goal-kinds.ts';
import { INFRACTION_KEYS, PENALTY_MINUTES } from '#config/infractions.ts';
import { PERIOD_NUMBERS, isPeriod } from '#config/periods.ts';
import { TEAM_KEYS } from '#config/teams.ts';
import { goalInputSchema, penaltyInputSchema } from './validators.ts';

describe('bornes des périodes', () => {
	const first = PERIOD_NUMBERS[0];
	const last = PERIOD_NUMBERS[PERIOD_NUMBERS.length - 1];

	it.each([
		[first, true, 'première période'],
		[last, true, 'dernière période'],
		[first - 1, false, 'une avant la première'],
		[last + 1, false, 'une après la dernière'],
		[2.5, false, 'fraction'],
		[Number.NaN, false, 'NaN']
	])('%s (%s): %s', (value, expected) => {
		expect(isPeriod(value)).toBe(expected);
	});

	it('ne déclare aucune période hors de la séquence', () => {
		expect(PERIOD_NUMBERS).toEqual([1, 2, 3, 4]);
		expect(PERIOD_NUMBERS.every((period) => isPeriod(period))).toBe(true);
	});

	it('accepte chaque période déclarée dans les schémas de feuille', () => {
		for (const period of PERIOD_NUMBERS) {
			expect(goalInputSchema.safeParse(goal(period)).success, `but ${period}`).toBe(true);
			expect(penaltyInputSchema.safeParse(penalty(period)).success, `punition ${period}`).toBe(
				true
			);
		}
	});

	it('refuse une période hors de la liste déclarée', () => {
		const outside = Math.max(...PERIOD_NUMBERS) + 1;
		expect(goalInputSchema.safeParse(goal(outside)).success).toBe(false);
		expect(penaltyInputSchema.safeParse(penalty(outside)).success).toBe(false);
	});
});

function goal(period: number) {
	return {
		team: TEAM_KEYS[0],
		period,
		clock: '10:00',
		kind: GOAL_KIND_KEYS[0],
		scorerPlayerId: 'player-1',
		assist1PlayerId: null,
		assist2PlayerId: null
	};
}

function penalty(period: number) {
	return {
		team: TEAM_KEYS[0],
		period,
		clock: '10:00',
		playerId: 'player-1',
		infraction: INFRACTION_KEYS[0],
		minutes: PENALTY_MINUTES[0],
		coincidental: false
	};
}
