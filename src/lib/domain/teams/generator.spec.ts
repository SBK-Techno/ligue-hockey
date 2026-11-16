import { describe, expect, it } from 'vitest';
import type { RosterTemplate } from '#config/roster.ts';
import { generateTeams, type GeneratorInput, type GeneratorPlayer } from './generator.ts';

const template: RosterTemplate = {
	forwardsPerTeam: 3,
	defensePerTeam: 2,
	goaliesPerTeam: 1
};

function player(
	id: string,
	position: GeneratorPlayer['position'],
	overall = 3,
	age = 30
): GeneratorPlayer {
	return { id, position, overall, age, kind: 'regular' };
}

function fullPool(): GeneratorPlayer[] {
	return [
		player('f1', 'forward', 4),
		player('f2', 'forward', 3),
		player('f3', 'forward', 2),
		player('f4', 'forward', 4),
		player('f5', 'forward', 3),
		player('f6', 'forward', 2),
		player('d1', 'defense', 4),
		player('d2', 'defense', 2),
		player('d3', 'defense', 4),
		player('d4', 'defense', 2),
		player('g1', 'goalie', 3),
		player('g2', 'goalie', 3)
	];
}

function input(overrides: Partial<GeneratorInput> = {}): GeneratorInput {
	return {
		players: fullPool(),
		template,
		rules: [],
		skillTolerance: 0.25,
		maxPlayers: 24,
		...overrides
	};
}

describe('generateTeams', () => {
	it('fills every slot with the exact positional template', () => {
		const result = generateTeams(input());

		expect(result.assignments).toHaveLength(12);
		expect(result.unfilled).toHaveLength(0);

		for (const team of ['white', 'black'] as const) {
			expect(
				result.assignments.filter((entry) => entry.team === team && entry.position === 'forward')
			).toHaveLength(3);
			expect(
				result.assignments.filter((entry) => entry.team === team && entry.position === 'defense')
			).toHaveLength(2);
			expect(
				result.assignments.filter((entry) => entry.team === team && entry.position === 'goalie')
			).toHaveLength(1);
		}
	});

	it('assigns each player at most once and keeps their position', () => {
		const result = generateTeams(input());
		const ids = result.assignments.map((entry) => entry.playerId);
		expect(new Set(ids).size).toBe(ids.length);

		const byId = new Map(fullPool().map((entry) => [entry.id, entry.position]));
		for (const assignment of result.assignments) {
			expect(byId.get(assignment.playerId)).toBe(assignment.position);
		}
	});

	it('is deterministic regardless of input order', () => {
		const first = generateTeams(input());
		const shuffled = [...fullPool()].reverse();
		const second = generateTeams(input({ players: shuffled }));

		expect(second.assignments).toEqual(first.assignments);
		expect(second.candidateKey).toBe(first.candidateKey);
	});

	it('honours must-play-together rules', () => {
		const result = generateTeams(
			input({
				rules: [
					{ id: 'r1', playerAId: 'f1', playerBId: 'f2', kind: 'must' }
				]
			})
		);

		const teamOf = new Map(result.assignments.map((entry) => [entry.playerId, entry.team]));
		expect(teamOf.get('f1')).toBe(teamOf.get('f2'));
		expect(result.violations).toHaveLength(0);
	});

	it('honours must-not-play-together rules', () => {
		const result = generateTeams(
			input({
				rules: [
					{ id: 'r1', playerAId: 'f1', playerBId: 'f2', kind: 'must_not' }
				]
			})
		);

		const teamOf = new Map(result.assignments.map((entry) => [entry.playerId, entry.team]));
		expect(teamOf.get('f1')).not.toBe(teamOf.get('f2'));
		expect(result.violations).toHaveLength(0);
	});

	it('reports the rule conflict instead of silently violating it', () => {
		const players = [
			player('a', 'forward'),
			player('b', 'forward'),
			player('c', 'forward')
		];
		const result = generateTeams(
			input({
				players,
				template: { forwardsPerTeam: 2, defensePerTeam: 0, goaliesPerTeam: 0 },
				rules: [
					{ id: 'ab', playerAId: 'a', playerBId: 'b', kind: 'must' },
					{ id: 'bc', playerAId: 'b', playerBId: 'c', kind: 'must' },
					{ id: 'ac', playerAId: 'a', playerBId: 'c', kind: 'must_not' }
				]
			})
		);

		expect(result.violations.length).toBeGreaterThan(0);
		expect(result.warnings).toContain('rule-conflict');
	});

	it('uses age to break a skill tie', () => {
		const players = [
			player('a', 'forward', 3, 20),
			player('b', 'forward', 3, 20),
			player('c', 'forward', 3, 40),
			player('d', 'forward', 3, 40)
		];
		const result = generateTeams(
			input({
				players,
				template: { forwardsPerTeam: 2, defensePerTeam: 0, goaliesPerTeam: 0 }
			})
		);

		expect(result.skillDiff).toBe(0);
		expect(result.ageDiff).toBe(0);
	});

	it('balances short rosters across both teams', () => {
		const players = [player('a', 'forward'), player('b', 'forward')];
		const result = generateTeams(
			input({
				players,
				template: { forwardsPerTeam: 3, defensePerTeam: 0, goaliesPerTeam: 0 }
			})
		);

		expect(result.sizeDiff).toBe(0);
		expect(result.unfilled).toHaveLength(4);
	});

	it('does not put two goalies on the same team', () => {
		const players = [player('g1', 'goalie'), player('g2', 'goalie')];
		const result = generateTeams(
			input({
				players,
				template: { forwardsPerTeam: 0, defensePerTeam: 0, goaliesPerTeam: 1 }
			})
		);

		const teams = result.assignments.map((entry) => entry.team).sort();
		expect(teams).toEqual(['black', 'white']);
	});

	it('rejects a pool larger than the configured maximum', () => {
		expect(() => generateTeams(input({ maxPlayers: 5 }))).toThrow();
	});
});

describe('generateTeams with rule preferences', () => {
	const fourForwards = [
		player('a', 'forward', 3, 30),
		player('b', 'forward', 3, 30),
		player('c', 'forward', 3, 30),
		player('d', 'forward', 3, 30)
	];
	const twoPerTeam: RosterTemplate = {
		forwardsPerTeam: 2,
		defensePerTeam: 0,
		goaliesPerTeam: 0
	};

	it('applies a soft preference when the balance is otherwise equal', () => {
		const result = generateTeams(
			input({
				players: fourForwards,
				template: twoPerTeam,
				rules: [
					{
						id: 'prefer',
						playerAId: 'a',
						playerBId: 'b',
						kind: 'must_not',
						strict: false
					}
				]
			})
		);

		const teamOf = new Map(result.assignments.map((entry) => [entry.playerId, entry.team]));
		expect(teamOf.get('a')).not.toBe(teamOf.get('b'));
		expect(result.violations).toHaveLength(0);
		expect(result.warnings).not.toContain('rule-preference');
	});

	it('reports an unmet preference without calling it a conflict', () => {
		const result = generateTeams(
			input({
				players: [player('a', 'forward'), player('b', 'forward')],
				template: { forwardsPerTeam: 1, defensePerTeam: 0, goaliesPerTeam: 0 },
				rules: [
					{
						id: 'prefer',
						playerAId: 'a',
						playerBId: 'b',
						kind: 'must',
						strict: false
					}
				]
			})
		);

		expect(result.violations).toHaveLength(1);
		expect(result.violations[0].strict).toBe(false);
		expect(result.warnings).toContain('rule-preference');
		expect(result.warnings).not.toContain('rule-conflict');
	});

	it('defaults a rule to strict when strength is omitted', () => {
		const result = generateTeams(
			input({
				players: [player('a', 'forward'), player('b', 'forward')],
				template: { forwardsPerTeam: 1, defensePerTeam: 0, goaliesPerTeam: 0 },
				rules: [{ id: 'hard', playerAId: 'a', playerBId: 'b', kind: 'must' }]
			})
		);

		expect(result.violations[0].strict).toBe(true);
		expect(result.warnings).toContain('rule-conflict');
	});
});

describe('generateTeams with league limits', () => {
	const unevenAges = [
		player('a', 'forward', 3, 20),
		player('b', 'forward', 3, 20),
		player('c', 'forward', 3, 20),
		player('d', 'forward', 3, 40)
	];
	const twoPerTeam: RosterTemplate = {
		forwardsPerTeam: 2,
		defensePerTeam: 0,
		goaliesPerTeam: 0
	};

	it('treats zero as no limit', () => {
		const result = generateTeams(
			input({
				players: unevenAges,
				template: twoPerTeam,
				limits: { skill: 0, age: 0, size: 0 }
			})
		);

		expect(result.warnings).not.toContain('rule-limit');
	});

	it('accepts a candidate inside the configured limits', () => {
		const result = generateTeams(
			input({
				players: unevenAges,
				template: twoPerTeam,
				limits: { skill: 0, age: 10, size: 0 }
			})
		);

		expect(result.warnings).not.toContain('rule-limit');
	});

	it('returns the best effort and a warning when no limit can be met', () => {
		const result = generateTeams(
			input({
				players: unevenAges,
				template: twoPerTeam,
				limits: { skill: 0, age: 1, size: 0 }
			})
		);

		expect(result.assignments).toHaveLength(4);
		expect(result.warnings).toContain('rule-limit');
	});
});

describe('generateTeams limit priority', () => {
	it('never trades a strict rule for an easier limit', () => {
		const result = generateTeams(
			input({
				players: [
					player('a', 'forward', 3, 40),
					player('b', 'forward', 3, 40),
					player('c', 'forward', 3, 20)
				],
				template: { forwardsPerTeam: 2, defensePerTeam: 0, goaliesPerTeam: 0 },
				rules: [{ id: 'hard', playerAId: 'a', playerBId: 'b', kind: 'must' }],
				limits: { skill: 0, age: 15, size: 0 }
			})
		);

		const teamOf = new Map(result.assignments.map((entry) => [entry.playerId, entry.team]));
		expect(teamOf.get('a')).toBe(teamOf.get('b'));
		expect(result.violations).toHaveLength(0);
		expect(result.warnings).toContain('rule-limit');
	});
});
