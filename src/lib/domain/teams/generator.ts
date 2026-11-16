import { POSITIONS, type Position } from '#config/positions.ts';
import type { RosterTemplate, SlotDefinition } from '#config/roster.ts';
import { TEAM_GENERATION, TEAMS, type Team } from '#config/teams.ts';
import type { PairRuleKind } from '#config/rule-modes.ts';

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
	strict?: boolean;
};

export type TeamLimits = {
	skill: number;
	age: number;
	size: number;
};

export type GeneratorInput = {
	players: readonly GeneratorPlayer[];
	template: RosterTemplate;
	rules: readonly GeneratorRule[];
	skillTolerance: number;
	maxPlayers: number;
	limits?: TeamLimits;
};

export type GeneratorViolation = {
	ruleId: string;
	kind: PairRuleKind;
	strict: boolean;
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

const [TEAM_A, TEAM_B] = [TEAMS[0].key, TEAMS[1].key] as const;

function zeroTotals(): Record<Team, number> {
	return Object.fromEntries(TEAMS.map((team) => [team.key, 0])) as Record<Team, number>;
}

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
					team: TEAM_A,
					position,
					slotIndex: index
				})),
				...teamBPlayers.map((player, index) => ({
					playerId: player.id,
					team: TEAM_B,
					position,
					slotIndex: index
				}))
			];

			const unfilled: SlotDefinition[] = [];
			for (const team of TEAMS) {
				const filled =
					team.key === TEAM_A ? teamAPlayers.length : teamBPlayers.length;
				const slots = team.key === TEAM_A ? slotsA : slotsB;
				for (let index = filled; index < slots; index += 1) {
					unfilled.push({ team: team.key, position, index });
				}
			}

			const skill = zeroTotals();
			const age = zeroTotals();
			for (const player of teamAPlayers) {
				skill[TEAM_A] += player.overall;
				age[TEAM_A] += player.age;
			}
			for (const player of teamBPlayers) {
				skill[TEAM_B] += player.overall;
				age[TEAM_B] += player.age;
			}

			options.push({
				assignments,
				unfilled,
				counts: { [TEAM_A]: teamAPlayers.length, [TEAM_B]: teamBPlayers.length },
				skill,
				age
			});
		}
	}

	return options;
}

export function pairViolations(
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
				strict: rule.strict !== false,
				playerIds: [rule.playerAId, rule.playerBId]
			});
		}

		if (rule.kind === 'must_not' && teamA === teamB) {
			violations.push({
				ruleId: rule.id,
				kind: rule.kind,
				strict: rule.strict !== false,
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
	if (candidateCount > TEAM_GENERATION.maxCandidates) {
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
					[TEAM_A]: current.counts[TEAM_A] + option.counts[TEAM_A],
					[TEAM_B]: current.counts[TEAM_B] + option.counts[TEAM_B]
				},
				skill: {
					[TEAM_A]: current.skill[TEAM_A] + option.skill[TEAM_A],
					[TEAM_B]: current.skill[TEAM_B] + option.skill[TEAM_B]
				},
				age: {
					[TEAM_A]: current.age[TEAM_A] + option.age[TEAM_A],
					[TEAM_B]: current.age[TEAM_B] + option.age[TEAM_B]
				},
				violations: []
			});
		}
	}

	walk(0, {
		assignments: [],
		unfilled: [],
		counts: zeroTotals(),
		skill: zeroTotals(),
		age: zeroTotals(),
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
		const sizeDiff = Math.abs(candidate.counts[TEAM_A] - candidate.counts[TEAM_B]);
		const skillDiff = Math.abs(
			average(candidate.skill[TEAM_A], candidate.counts[TEAM_A]) -
				average(candidate.skill[TEAM_B], candidate.counts[TEAM_B])
		);
		// Le critère demandé est l'âge cumulatif : on compare la somme des âges
		// des deux équipes, pas leur moyenne, pour que la profondeur du banc
		// compte aussi.
		const ageDiff = Math.abs(candidate.age[TEAM_A] - candidate.age[TEAM_B]);
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

		const hard = candidate.violations.filter((violation) => violation.strict).length;
		return {
			candidate,
			sizeDiff,
			skillDiff,
			ageDiff,
			key,
			hard,
			soft: candidate.violations.length - hard
		};
	});

	scored.sort(
		(a, b) =>
			a.hard - b.hard ||
			a.sizeDiff - b.sizeDiff ||
			a.skillDiff - b.skillDiff ||
			a.ageDiff - b.ageDiff ||
			a.soft - b.soft ||
			a.key.localeCompare(b.key)
	);

	const limits = input.limits ?? { skill: 0, age: 0, size: 0 };
	const withinLimits = (entry: (typeof scored)[number]) =>
		(limits.skill === 0 || entry.skillDiff <= limits.skill) &&
		(limits.age === 0 || entry.ageDiff <= limits.age) &&
		(limits.size === 0 || entry.sizeDiff <= limits.size);
	const minHard = Math.min(...scored.map((entry) => entry.hard));
	const hardPool = scored.filter((entry) => entry.hard === minHard);
	const eligible = hardPool.filter(withinLimits);
	const considered = eligible.length > 0 ? eligible : hardPool;

	const best = considered[0];
	const tolerant = considered.filter(
		(entry) =>
			entry.hard === best.hard &&
			entry.sizeDiff === best.sizeDiff &&
			entry.skillDiff <= best.skillDiff + input.skillTolerance
	);
	tolerant.sort(
		(a, b) =>
			a.ageDiff - b.ageDiff ||
			a.soft - b.soft ||
			a.skillDiff - b.skillDiff ||
			a.key.localeCompare(b.key)
	);
	const chosen = tolerant[0] ?? best;

	const warnings: string[] = [];
	if (chosen.candidate.unfilled.length > 0) {
		warnings.push('unfilled-slots');
	}
	if (chosen.hard > 0) {
		warnings.push('rule-conflict');
	}
	if (chosen.soft > 0) {
		warnings.push('rule-preference');
	}
	if (eligible.length === 0 && (limits.skill > 0 || limits.age > 0 || limits.size > 0)) {
		warnings.push('rule-limit');
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
