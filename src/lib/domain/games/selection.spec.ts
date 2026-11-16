import { describe, expect, it } from 'vitest';
import type { Position } from '#config/positions.ts';
import type { RosterTemplate } from '#config/roster.ts';
import { TEAMS } from '#config/teams.ts';
import { selectGenerationPlayers, type SelectionCandidate } from './selection.ts';

const template: RosterTemplate = {
	forwardsPerTeam: 3,
	defensePerTeam: 2,
	goaliesPerTeam: 1
};

function member(
	id: string,
	position: Position,
	kind: 'regular' | 'sub' = 'regular',
	order = 0,
	eligiblePositions: readonly Position[] = [position]
): SelectionCandidate {
	return { playerId: id, position, eligiblePositions, kind, order };
}

function present(
	position: Position,
	count: number,
	prefix = position[0]
): SelectionCandidate[] {
	return Array.from({ length: count }, (_, index) =>
		member(`${prefix}${index + 1}`, position, 'regular', index)
	);
}

describe('selectGenerationPlayers', () => {
	it('fills every positional slot when the roster is complete', () => {
		const members = [
			...present('forward', 6, 'f'),
			...present('defense', 4, 'd'),
			...present('goalie', 2, 'g')
		];
		const result = selectGenerationPlayers(members, template);

		expect(result.selected).toHaveLength(12);
		expect(result.bench).toEqual([]);
	});

	it('keeps three forwards selected and one slot open when only three are present', () => {
		const result = selectGenerationPlayers(present('forward', 3), {
			forwardsPerTeam: 2,
			defensePerTeam: 0,
			goaliesPerTeam: 0
		});

		expect(result.selected).toHaveLength(3);
		expect(result.bench).toEqual([]);
	});

	it.each([
		{
			label: 'reserves the claimed spot before filling regulars',
			members: [
				...present('forward', 6, 'f'),
				member('s1', 'forward', 'sub', 100)
			],
			expectedBench: [{ playerId: 'f6', position: 'forward', kind: 'regular' }]
		},
		{
			label: 'benches a claimed substitute beyond position capacity',
			members: [
				...present('forward', 6, 'f'),
				member('s1', 'forward', 'sub', 100),
				member('s2', 'forward', 'sub', 200)
			],
			expectedBench: [
				{ playerId: 'f5', position: 'forward', kind: 'regular' },
				{ playerId: 'f6', position: 'forward', kind: 'regular' }
			]
		},
		{
			label: 'benches the latest regulars beyond each position capacity',
			members: present('forward', 7, 'f'),
			expectedBench: [{ playerId: 'f7', position: 'forward', kind: 'regular' }]
		}
	])('$label', ({ members, expectedBench }) => {
		const result = selectGenerationPlayers(members, template);

		expect(result.bench).toEqual(
			expect.arrayContaining(expectedBench.map((entry) => expect.objectContaining(entry)))
		);
	});

	it('ignores absent, inactive, and unclaimed substitutes in the live membership', () => {
		const result = selectGenerationPlayers([member('f1', 'forward')], {
			forwardsPerTeam: 3,
			defensePerTeam: 0,
			goaliesPerTeam: 0
		});

		expect(result.selected.map((entry) => entry.playerId)).toEqual(['f1']);
		expect(result.bench).toEqual([]);
	});

	it('uses a claimed position instead of the native position for a substitute', () => {
		const result = selectGenerationPlayers(
			[member('s1', 'forward', 'sub', 100, ['defense'])],
			{ forwardsPerTeam: 1, defensePerTeam: 1, goaliesPerTeam: 0 }
		);

		expect(result.selected).toEqual([
			expect.objectContaining({ playerId: 's1', selectionPosition: 'defense' })
		]);
	});
});

describe('generation selection invariants', () => {
	const teamCount = TEAMS.length;

	it('never selects more players than the positional capacity and never twice', () => {
		for (const forwards of [0, 1, 3, 4, 7]) {
			for (const defense of [0, 2, 5]) {
				for (const goalies of [0, 1, 3]) {
					const members = [
						...present('forward', forwards, 'f'),
						...present('defense', defense, 'd'),
						...present('goalie', goalies, 'g')
					];
					const result = selectGenerationPlayers(members, template);
					const ids = result.selected.map((entry) => entry.playerId);
					expect(new Set(ids).size).toBe(ids.length);

					for (const position of ['forward', 'defense', 'goalie'] as const) {
						const capacity =
							(position === 'forward'
								? template.forwardsPerTeam
								: position === 'defense'
									? template.defensePerTeam
									: template.goaliesPerTeam) * teamCount;
						const selected = result.selected.filter(
							(entry) => entry.selectionPosition === position
						);
						expect(selected.length).toBeLessThanOrEqual(capacity);
					}
					expect(result.selected.length + result.bench.length).toBe(members.length);
				}
			}
		}
	});
});
