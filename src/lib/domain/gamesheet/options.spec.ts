import { describe, expect, it } from 'vitest';
import { GOAL_KINDS } from '#config/goal-kinds.ts';
import { TEAMS, otherTeam } from '#config/teams.ts';
import { goalEntryOptions } from './options.ts';

describe('options de saisie d’un but', () => {
	it.each(TEAMS.flatMap((team) => GOAL_KINDS.map((kind) => [team.key, kind.key] as const)))(
		'%s / %s suit le camp crédité',
		(team, kind) => {
			const options = goalEntryOptions(team, kind);
			if (kind === 'own_goal') {
				expect(options).toEqual({
					scorerTeam: otherTeam(team),
					assistsAllowed: false
				});
			} else {
				expect(options).toEqual({ scorerTeam: team, assistsAllowed: true });
			}
		}
	);
});
