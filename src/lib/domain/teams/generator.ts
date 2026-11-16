import { POSITIONS, type Position } from '#config/positions.ts';
import type { RosterTemplate, SlotDefinition } from '#config/roster.ts';
import { TEAMS, type Team } from '#config/teams.ts';
import type { PairRuleKind } from '#lib/domain/rules/schema.ts';

export type GeneratorPlayer = {
	id: string;
	position: Position;
	age: number;
	overall: number;
	kind: 'regular' | 'sub';
};

export type GeneratorRule = {
	id: string;
	playerAId: string;
	playerBId: string;
	kind: PairRuleKind;
};

export type GeneratorInput = {
	players: readonly GeneratorPlayer[];
	template: RosterTemplate;
	rules: readonly GeneratorRule[];
	skillTolerance: number;
	maxPlayers: number;
};

export type GeneratorViolation = {
	ruleId: string;
	kind: PairRuleKind;
	playerIds: [string, string];
};

export type GeneratorAssignment = {
	playerId: string;
	team: Team;
	position: Position;
	slotIndex: number;
};

export type GeneratorResult = {
	assignments: GeneratorAssignment[];
	unfilled: SlotDefinition[];
	skillDiff: number;
	ageDiff: number;
	sizeDiff: number;
	violations: GeneratorViolation[];
	warnings: string[];
	candidateKey: string;
};

type PositionOption = {
	assignments: GeneratorAssignment[];
	unfilled: SlotDefinition[];
	counts: Record<Team, number>;
	skill: Record<Team, number>;
	age: Record<Team, number>;
};

const MAX_CANDIDATES = 200_000;

function combinations<T>(items: readonly T[], size: number): T[][] {
	if (size === 0) return [[]];
	if (size > items.length) return [];
	if (size === items.length) return [[...items]];

	const result: T[][] = [];
	const current: T[] = [];

	function walk(start: number) {
		if (current.length === size) {
			result.push([...current]);
			return;
		}
		for (let index = start; index < items.length; index += 1) {
			current.push(items[index]);
			walk(index + 1);
			current.pop();
		}
	}

	walk(0);
	return result;
}

function slotsForPosition(template: RosterTemplate, position: Position): number {
	switch (position) {
		case 'forward':
			return template.forwardsPerTeam;
		case 'defense':
			return template.defensePerTeam;
		case 'goalie':
			return template.goaliesPerTeam;
	}
}

function buildPositionOptions(
	players: readonly GeneratorPlayer[],
	position: Position,
	template: RosterTemplate
): PositionOption[] {
	const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id));
	const slotsA = slotsForPosition(template, position);
	const slotsB = slotsA;
	const capacity = slotsA + slotsB;

	if (sorted.length > capacity) {
		throw new Error(
			`Too many ${position} players: ${sorted.length} for ${capacity} slots`
		);
	}

	const minA = Math.max(0, sorted.length - slotsB);
	const maxA = Math.min(slotsA, sorted.length);
	const options: PositionOption[] = [];

	for (let countA = minA; countA <= maxA; countA += 1) {
		for (const teamAPlayers of combinations(sorted, countA)) {
			const teamAIds = new Set(teamAPlayers.map((player) => player.id));
			const teamBPlayers = sorted
				.filter((player) => !teamAIds.has(player.id))
				.slice(0, slotsB);

			const assignments: GeneratorAssignment[] = [
				...teamAPlayers.map((player, index) => ({
					playerId: player.id,
					team: 'white' as const,
					position,
					slotIndex: index
				})),
				...teamBPlayers.map((player, index) => ({
					playerId: player.id,
					team: 'black' as const,
					position,
					slotIndex: index
				}))
			];

			const unfilled: SlotDefinition[] = [];
			for (const team of TEAMS) {
				const filled =
					team.key === 'white' ? teamAPlayers.length : teamBPlayers.length;
				const slots = team.key === 'white' ? slotsA : slotsB;
				for (let index = filled; index < slots; index += 1) {
					unfilled.push({ team: team.key, position, index });
				}
			}

			const skill = { white: 0, black: 0 };
			const age = { white: 0, black: 0 };
			for (const player of teamAPlayers) {
				skill.white += player.overall;
				age.white += player.age;
			}
			for (const player of teamBPlayers) {
				skill.black += player.overall;
				age.black += player.age;
			}

			options.push({
				assignments,
				unfilled,
				counts: { white: teamAPlayers.length, black: teamBPlayers.length },
				skill,
				age
			});
		}
	}

	return options;
}

function pairViolations(
	teamOf: Map<string, Team>,
	rules: readonly GeneratorRule[]
): GeneratorViolation[] {
	const violations: GeneratorViolation[] = [];

	for (const rule of rules) {
		const teamA = teamOf.get(rule.playerAId);
		const teamB = teamOf.get(rule.playerBId);
		if (!teamA || !teamB) continue;

		if (rule.kind === 'must' && teamA !== teamB) {
			violations.push({
				ruleId: rule.id,
				kind: rule.kind,
				playerIds: [rule.playerAId, rule.playerBId]
			});
		}

		if (rule.kind === 'must_not' && teamA === teamB) {
			violations.push({
				ruleId: rule.id,
				kind: rule.kind,
				playerIds: [rule.playerAId, rule.playerBId]
			});
		}
	}

	return violations;
}

function average(total: number, count: number): number {
	return count === 0 ? 0 : total / count;
}

export function generateTeams(input: GeneratorInput): GeneratorResult {
	if (input.players.length > input.maxPlayers) {
		throw new Error(
			`Too many players: ${input.players.length} > ${input.maxPlayers}`
		);
	}

	const byPosition = new Map<Position, GeneratorPlayer[]>();
	for (const position of POSITIONS) {
		byPosition.set(position.key, []);
	}
	for (const player of input.players) {
		byPosition.get(player.position)?.push(player);
	}

	const optionsByPosition = POSITIONS.map((position) => ({
		position: position.key,
		options: buildPositionOptions(
			byPosition.get(position.key) ?? [],
			position.key,
			input.template
		)
	}));

	const candidateCount = optionsByPosition.reduce(
		(product, entry) => product * Math.max(1, entry.options.length),
		1
	);
	if (candidateCount > MAX_CANDIDATES) {
		throw new Error(`Team generation is too complex: ${candidateCount} candidates`);
	}

	type Candidate = {
		assignments: GeneratorAssignment[];
		unfilled: SlotDefinition[];
		counts: Record<Team, number>;
		skill: Record<Team, number>;
		age: Record<Team, number>;
		violations: GeneratorViolation[];
	};

	const candidates: Candidate[] = [];

	function walk(index: number, current: Candidate) {
		if (index === optionsByPosition.length) {
			const teamOf = new Map<string, Team>();
			for (const assignment of current.assignments) {
				teamOf.set(assignment.playerId, assignment.team);
			}
			candidates.push({
				...current,
				violations: pairViolations(teamOf, input.rules)
			});
			return;
		}

		const entry = optionsByPosition[index];
		if (entry.options.length === 0) {
			walk(index + 1, current);
			return;
		}

		for (const option of entry.options) {
			walk(index + 1, {
				assignments: [...current.assignments, ...option.assignments],
				unfilled: [...current.unfilled, ...option.unfilled],
				counts: {
					white: current.counts.white + option.counts.white,
					black: current.counts.black + option.counts.black
				},
				skill: {
					white: current.skill.white + option.skill.white,
					black: current.skill.black + option.skill.black
				},
				age: {
					white: current.age.white + option.age.white,
					black: current.age.black + option.age.black
				},
				violations: []
			});
		}
	}

	walk(0, {
		assignments: [],
		unfilled: [],
		counts: { white: 0, black: 0 },
		skill: { white: 0, black: 0 },
		age: { white: 0, black: 0 },
		violations: []
	});

	if (candidates.length === 0) {
		return {
			assignments: [],
			unfilled: [...POSITIONS].flatMap((position) => {
				const slots = slotsForPosition(input.template, position.key);
				return TEAMS.flatMap((team) =>
					Array.from({ length: slots }, (_, index) => ({
						team: team.key,
						position: position.key,
						index
					}))
				);
			}),
			skillDiff: 0,
			ageDiff: 0,
			sizeDiff: 0,
			violations: [],
			warnings: ['no-players'],
			candidateKey: ''
		};
	}

	const scored = candidates.map((candidate) => {
		const sizeDiff = Math.abs(candidate.counts.white - candidate.counts.black);
		const skillDiff = Math.abs(
			average(candidate.skill.white, candidate.counts.white) -
				average(candidate.skill.black, candidate.counts.black)
		);
		const ageDiff = Math.abs(
			average(candidate.age.white, candidate.counts.white) -
				average(candidate.age.black, candidate.counts.black)
		);
		const key = [...candidate.assignments]
			.sort(
				(a, b) =>
					a.team.localeCompare(b.team) ||
					a.position.localeCompare(b.position) ||
					a.slotIndex - b.slotIndex
			)
			.map(
				(assignment) =>
					`${assignment.team}:${assignment.position}:${assignment.slotIndex}:${assignment.playerId}`
			)
			.join('|');

		return {
			candidate,
			sizeDiff,
			skillDiff,
			ageDiff,
			key,
			violations: candidate.violations.length
		};
	});

	scored.sort(
		(a, b) =>
			a.violations - b.violations ||
			a.sizeDiff - b.sizeDiff ||
			a.skillDiff - b.skillDiff ||
			a.ageDiff - b.ageDiff ||
			a.key.localeCompare(b.key)
	);

	const best = scored[0];
	const tolerant = scored.filter(
		(entry) =>
			entry.violations === best.violations &&
			entry.sizeDiff === best.sizeDiff &&
			entry.skillDiff <= best.skillDiff + input.skillTolerance
	);
	tolerant.sort(
		(a, b) =>
			a.ageDiff - b.ageDiff ||
			a.skillDiff - b.skillDiff ||
			a.key.localeCompare(b.key)
	);
	const chosen = tolerant[0] ?? best;

	const warnings: string[] = [];
	if (chosen.candidate.unfilled.length > 0) {
		warnings.push('unfilled-slots');
	}
	if (chosen.violations > 0) {
		warnings.push('rule-conflict');
	}

	return {
		assignments: [...chosen.candidate.assignments].sort(
			(a, b) =>
				a.team.localeCompare(b.team) ||
				a.position.localeCompare(b.position) ||
				a.slotIndex - b.slotIndex
		),
		unfilled: chosen.candidate.unfilled,
		skillDiff: Number(chosen.skillDiff.toFixed(3)),
		ageDiff: Number(chosen.ageDiff.toFixed(2)),
		sizeDiff: chosen.sizeDiff,
		violations: chosen.candidate.violations,
		warnings,
		candidateKey: chosen.key
	};
}
