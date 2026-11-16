import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Position } from '#config/positions.ts';
import type { RosterTemplate } from '#config/roster.ts';
import { TEAMS } from '#config/teams.ts';
import { fillSuggestions, type Placement } from '#lib/domain/teams/balance.ts';
import { generateTeams } from '#lib/domain/teams/generator.ts';
import { selectGenerationPlayers, type SelectionCandidate } from './selection.ts';

type Member = SelectionCandidate & { overall: number; age: number };

function member(id: string, position: Position, order: number): Member {
	return {
		playerId: id,
		position,
		eligiblePositions: [position],
		kind: 'regular',
		order,
		overall: 1 + (order % 5),
		age: 20 + (order % 20)
	};
}

function roster(
	forwards: number,
	defense: number,
	goalies: number
): Member[] {
	return [
		...Array.from({ length: forwards }, (_, index) => member(`f${index}`, 'forward', index)),
		...Array.from({ length: defense }, (_, index) => member(`d${index}`, 'defense', index)),
		...Array.from({ length: goalies }, (_, index) => member(`g${index}`, 'goalie', index))
	];
}

const template: RosterTemplate = {
	forwardsPerTeam: 3,
	defensePerTeam: 1,
	goaliesPerTeam: 1
};

describe('generated lineup invariants', () => {
	it('keeps the exact position counts from the selection', () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 0, max: 6 }),
				fc.integer({ min: 0, max: 2 }),
				fc.integer({ min: 0, max: 2 }),
				(forwards, defense, goalies) => {
					const members = roster(forwards, defense, goalies);
					const selection = selectGenerationPlayers(members, template);
					const result = generateTeams({
						players: selection.selected.map((entry) => ({
							id: entry.playerId,
							position: entry.selectionPosition,
							age: entry.age,
							overall: entry.overall,
							kind: entry.kind
						})),
						template,
						rules: [],
						skillTolerance: 0.25,
						maxPlayers: 24
					});

					const ids = result.assignments.map((entry) => entry.playerId);
					expect(new Set(ids).size).toBe(ids.length);
					expect(result.assignments).toHaveLength(selection.selected.length);

					for (const position of ['forward', 'defense', 'goalie'] as const) {
						const selected = selection.selected.filter(
							(entry) => entry.selectionPosition === position
						);
						const assigned = result.assignments.filter(
							(entry) => entry.position === position
						);
						expect(assigned).toHaveLength(selected.length);
						const perTeam =
							position === 'forward'
								? template.forwardsPerTeam
								: position === 'defense'
									? template.defensePerTeam
									: template.goaliesPerTeam;
						for (const team of TEAMS) {
							expect(
								assigned.filter((entry) => entry.team === team.key).length
							).toBeLessThanOrEqual(perTeam);
						}
					}
				}
			),
			{ numRuns: 60 }
		);
	});

	it('fills open slots from live players even when the saved bench would be empty', () => {
		fc.assert(
			fc.property(fc.integer({ min: 1, max: 5 }), (placedCount) => {
				const capacity = template.forwardsPerTeam * TEAMS.length;
				const availableCount = capacity - placedCount - 1;
				fc.pre(availableCount > 0);

				const members = roster(placedCount + availableCount, 0, 0);
				const placedMembers = members.slice(0, placedCount);
				const placedIds = new Set(placedMembers.map((member) => member.playerId));
				const availableMembers = members.filter(
					(member) => !placedIds.has(member.playerId)
				);

				const placements: Placement[] = placedMembers.map((member, index) => ({
					playerId: member.playerId,
					team: TEAMS[index % TEAMS.length].key,
					position: 'forward'
				}));
				const counts = Object.fromEntries(
					TEAMS.map((team) => [
						team.key,
						placements.filter((placement) => placement.team === team.key).length
					])
				) as Record<(typeof TEAMS)[number]['key'], number>;
				const openSlots = TEAMS.flatMap((team) =>
					Array.from(
						{
							length: template.forwardsPerTeam - counts[team.key]
						},
						(_, index) => ({
							team: team.key,
							position: 'forward' as const,
							index: counts[team.key] + index
						})
					)
				);

				// L'ancien banc enregistré était vide : tous les présents tenaient
				// dans les places. Le bassin vivant, lui, contient encore du monde.
				expect(openSlots.length).toBeGreaterThan(0);
				expect(availableMembers.length).toBeGreaterThan(0);

				const suggestions = fillSuggestions({
					openSlots,
					placements,
					pool: members.map((member) => ({
						id: member.playerId,
						position: member.position,
						age: member.age,
						overall: member.overall,
						kind: member.kind,
						eligiblePositions: member.eligiblePositions
					})),
					rules: []
				});

				expect(suggestions).toHaveLength(availableMembers.length);
				expect(new Set(suggestions.map((entry) => entry.playerId)).size).toBe(
					suggestions.length
				);
				for (const suggestion of suggestions) {
					expect(
						availableMembers.some((member) => member.playerId === suggestion.playerId)
					).toBe(true);
					expect(suggestion.slot.position).toBe('forward');
				}
			}),
			{ numRuns: 40 }
		);
	});
});
