import { describe, expect, it } from 'vitest';
import type { Position } from '#config/positions.ts';
import type { GeneratorPlayer, GeneratorRule } from './generator.ts';
import {
	balanceView,
	bestSwap,
	fillSuggestions,
	type FillCandidate,
	type Placement
} from './balance.ts';

function player(
	id: string,
	position: Position,
	overall: number,
	age = 30
): GeneratorPlayer {
	return { id, position, overall, age, kind: 'regular' };
}

function candidate(
	id: string,
	position: Position,
	overall: number,
	options: { age?: number; eligiblePositions?: Position[] } = {}
): FillCandidate {
	return {
		id,
		position,
		overall,
		age: options.age ?? 30,
		kind: 'regular',
		eligiblePositions: options.eligiblePositions
	};
}

function place(id: string, team: 'white' | 'black', position: Position): Placement {
	return { playerId: id, team, position };
}

function rule(
	id: string,
	playerAId: string,
	playerBId: string,
	kind: 'must' | 'must_not',
	strict = true
): GeneratorRule {
	return { id, playerAId, playerBId, kind, strict };
}

describe('balanceView', () => {
	it('measures the same three spreads as the generator', () => {
		const players = [
			player('a', 'forward', 5, 30),
			player('b', 'forward', 3, 40),
			player('c', 'forward', 4, 28),
			player('d', 'forward', 2, 32)
		];
		const view = balanceView(
			[
				place('a', 'white', 'forward'),
				place('b', 'white', 'forward'),
				place('c', 'black', 'forward'),
				place('d', 'black', 'forward')
			],
			players
		);

		expect(view.complete).toBe(true);
		expect(view.skillDiff).toBe(1);
		expect(view.ageDiff).toBe(10);
		expect(view.sizeDiff).toBe(0);
		expect(view.totals.white.skillAverage).toBe(4);
		expect(view.totals.black.skillAverage).toBe(3);
	});

	it('reports an incomplete lineup instead of a zero gap when a team is empty', () => {
		const view = balanceView(
			[place('a', 'white', 'forward'), place('b', 'white', 'forward')],
			[player('a', 'forward', 5), player('b', 'forward', 3)]
		);

		expect(view.complete).toBe(false);
		expect(view.skillDiff).toBeNull();
		expect(view.sizeDiff).toBe(2);
		expect(view.totals.black.count).toBe(0);
	});

	it('ignores players missing from the pool instead of inventing a rating', () => {
		const view = balanceView([place('missing', 'white', 'forward')], []);

		expect(view.totals.white.count).toBe(0);
		expect(view.complete).toBe(false);
		expect(view.skillDiff).toBeNull();
	});
});

describe('bestSwap strict and soft rules', () => {
	it('never repairs a soft preference by creating a strict violation', () => {
		const players = [
			player('P', 'forward', 5),
			player('Y', 'forward', 4),
			player('Q', 'forward', 1),
			player('X', 'forward', 2)
		];
		const suggestion = bestSwap({
			placements: [
				place('P', 'white', 'forward'),
				place('Y', 'white', 'forward'),
				place('Q', 'black', 'forward'),
				place('X', 'black', 'forward')
			],
			players,
			rules: [
				rule('soft', 'Y', 'X', 'must', false),
				rule('hard', 'P', 'Q', 'must_not', true)
			]
		});

		expect(suggestion).toMatchObject({
			playerAId: 'P',
			playerBId: 'Q',
			skillDiffBefore: 3,
			skillDiffAfter: 1,
			ageDiffBefore: 0,
			ageDiffAfter: 0
		});
		expect(`${suggestion?.playerAId}:${suggestion?.playerBId}`).not.toBe('P:X');
	});

	it('keeps working when a strict violation already exists elsewhere', () => {
		const players = [
			player('P', 'forward', 5),
			player('Y', 'forward', 4),
			player('Q', 'forward', 1),
			player('X', 'forward', 2),
			player('E', 'forward', 3),
			player('F', 'forward', 3)
		];
		const suggestion = bestSwap({
			placements: [
				place('P', 'white', 'forward'),
				place('Y', 'white', 'forward'),
				place('E', 'white', 'forward'),
				place('F', 'white', 'forward'),
				place('Q', 'black', 'forward'),
				place('X', 'black', 'forward')
			],
			players,
			rules: [
				rule('soft', 'Y', 'X', 'must', false),
				rule('hard', 'P', 'Q', 'must_not', true),
				rule('existing', 'E', 'F', 'must_not', true)
			]
		});

		expect(suggestion).toMatchObject({ playerAId: 'E', playerBId: 'X' });
	});

	it('accepts a soft repair even when the skill spread gets worse', () => {
		const suggestion = bestSwap({
			placements: [
				place('a', 'white', 'forward'),
				place('x', 'white', 'forward'),
				place('b', 'black', 'forward'),
				place('y', 'black', 'forward')
			],
			players: [
				player('a', 'forward', 5),
				player('x', 'forward', 1),
				player('b', 'forward', 4),
				player('y', 'forward', 4)
			],
			rules: [rule('soft', 'a', 'b', 'must', false)]
		});

		expect(suggestion).toMatchObject({
			playerAId: 'a',
			playerBId: 'y',
			skillDiffBefore: 1,
			skillDiffAfter: 2
		});
	});
});

describe('bestSwap ranking and guards', () => {
	it.each([
		{
			label: 'returns nothing when the teams are already close enough',
			placements: [
				place('a', 'white', 'forward'),
				place('b', 'white', 'forward'),
				place('c', 'black', 'forward'),
				place('d', 'black', 'forward')
			],
			players: [
				player('a', 'forward', 4),
				player('b', 'forward', 4),
				player('c', 'forward', 4),
				player('d', 'forward', 4)
			],
			rules: [],
			maxAgeSpread: 0,
			expected: null
		},
		{
			label: 'only swaps players who play the same position',
			placements: [
				place('a', 'white', 'forward'),
				place('b', 'white', 'forward'),
				place('c', 'black', 'defense'),
				place('d', 'black', 'defense')
			],
			players: [
				player('a', 'forward', 5),
				player('b', 'forward', 3),
				player('c', 'defense', 2),
				player('d', 'defense', 2)
			],
			rules: [],
			maxAgeSpread: 0,
			expected: null
		},
		{
			label: 'never swaps a player with a duplicate of themselves',
			placements: [
				place('a', 'white', 'forward'),
				place('a', 'white', 'forward'),
				place('b', 'white', 'forward'),
				place('c', 'black', 'forward'),
				place('d', 'black', 'forward')
			],
			players: [
				player('a', 'forward', 5),
				player('b', 'forward', 3),
				player('c', 'forward', 2),
				player('d', 'forward', 2)
			],
			rules: [],
			maxAgeSpread: 0,
			expected: 'a:c'
		},
		{
			label: 'rejects a skill gain that blows the age spread',
			placements: [
				place('a', 'white', 'forward'),
				place('b', 'white', 'forward'),
				place('c', 'black', 'forward'),
				place('d', 'black', 'forward')
			],
			players: [
				player('a', 'forward', 5, 40),
				player('b', 'forward', 3, 20),
				player('c', 'forward', 4, 20),
				player('d', 'forward', 2, 40)
			],
			rules: [],
			maxAgeSpread: 10,
			expected: null
		},
		{
			label: 'falls back to a legal swap when the even swaps are forbidden',
			placements: [
				place('a', 'white', 'forward'),
				place('b', 'white', 'forward'),
				place('c', 'black', 'forward'),
				place('d', 'black', 'forward')
			],
			players: [
				player('a', 'forward', 5),
				player('b', 'forward', 4),
				player('c', 'forward', 3),
				player('d', 'forward', 2)
			],
			rules: [rule('hard', 'a', 'd', 'must_not', true)],
			maxAgeSpread: 0,
			expected: 'a:d'
		}
	])('$label', ({ placements, players, rules, maxAgeSpread, expected }) => {
		const suggestion = bestSwap({ placements, players, rules, maxAgeSpread });
		expect(
			suggestion ? `${suggestion.playerAId}:${suggestion.playerBId}` : null
		).toBe(expected);
	});

	it('accepts the same age regression when no age limit is configured', () => {
		const suggestion = bestSwap({
			placements: [
				place('a', 'white', 'forward'),
				place('b', 'white', 'forward'),
				place('c', 'black', 'forward'),
				place('d', 'black', 'forward')
			],
			players: [
				player('a', 'forward', 5, 40),
				player('b', 'forward', 3, 20),
				player('c', 'forward', 4, 20),
				player('d', 'forward', 2, 40)
			],
			rules: [],
			maxAgeSpread: 0
		});

		expect(suggestion).not.toBeNull();
		expect(suggestion?.ageDiffAfter).toBeGreaterThan(suggestion?.ageDiffBefore ?? 0);
	});
});

describe('fillSuggestions live pool', () => {
	const rules: GeneratorRule[] = [];

	it.each([
		{
			label: 'fills an open slot with the available player who balances best',
			openSlots: [{ team: 'black' as const, position: 'forward' as const, index: 1 }],
			placements: [place('a', 'white', 'forward'), place('b', 'black', 'forward')],
			pool: [
				candidate('a', 'forward', 5),
				candidate('b', 'forward', 2),
				candidate('strong', 'forward', 5),
				candidate('weak', 'forward', 1)
			],
			expected: ['strong']
		},
		{
			label: 'fills even when the lineup already has a preference violation',
			openSlots: [{ team: 'black' as const, position: 'forward' as const, index: 1 }],
			placements: [place('a', 'white', 'forward'), place('b', 'black', 'forward')],
			pool: [
				candidate('a', 'forward', 5),
				candidate('b', 'forward', 2),
				candidate('d', 'forward', 3)
			],
			rules: [rule('soft', 'a', 'b', 'must', false)],
			expected: ['d']
		},
		{
			label: 'never places a forward-only substitute at defence',
			openSlots: [{ team: 'white' as const, position: 'defense' as const, index: 0 }],
			placements: [],
			pool: [candidate('sub', 'forward', 4)],
			expected: []
		},
		{
			label: 'places a substitute in the position they claimed',
			openSlots: [{ team: 'white' as const, position: 'defense' as const, index: 0 }],
			placements: [],
			pool: [candidate('sub', 'forward', 4, { eligiblePositions: ['defense'] })],
			expected: ['sub']
		},
		{
			label: 'never puts a skater in a goalie slot',
			openSlots: [{ team: 'white' as const, position: 'goalie' as const, index: 0 }],
			placements: [],
			pool: [candidate('f', 'forward', 4)],
			expected: []
		},
		{
			label: 'partially fills when there are fewer players than slots',
			openSlots: [
				{ team: 'white' as const, position: 'forward' as const, index: 1 },
				{ team: 'black' as const, position: 'forward' as const, index: 1 }
			],
			placements: [place('a', 'white', 'forward'), place('b', 'black', 'forward')],
			pool: [
				candidate('a', 'forward', 5),
				candidate('b', 'forward', 2),
				candidate('only', 'forward', 4)
			],
			expected: ['only']
		},
		{
			label: 'uses a duplicated pool id only once',
			openSlots: [
				{ team: 'white' as const, position: 'forward' as const, index: 1 },
				{ team: 'black' as const, position: 'forward' as const, index: 1 }
			],
			placements: [place('a', 'white', 'forward')],
			pool: [candidate('dup', 'forward', 4), candidate('dup', 'forward', 5)],
			expected: ['dup']
		},
		{
			label: 'leaves a slot open rather than increasing a strict violation',
			openSlots: [{ team: 'white' as const, position: 'forward' as const, index: 1 }],
			placements: [place('a', 'white', 'forward')],
			pool: [candidate('a', 'forward', 5), candidate('b', 'forward', 4)],
			rules: [rule('hard', 'a', 'b', 'must_not', true)],
			expected: []
		},
		{
			label: 'returns nothing when there is no one to fill',
			openSlots: [{ team: 'white' as const, position: 'forward' as const, index: 1 }],
			placements: [place('a', 'white', 'forward')],
			pool: [candidate('a', 'forward', 5)],
			expected: []
		}
	])('$label', ({ openSlots, placements, pool, rules: pairRules = [], expected }) => {
		const suggestions = fillSuggestions({
			openSlots,
			placements,
			pool,
			rules: pairRules
		});

		expect(suggestions.map((suggestion) => suggestion.playerId)).toEqual(expected);
	});

	it('fills the team with fewer players first', () => {
		const suggestions = fillSuggestions({
			openSlots: [
				{ team: 'white', position: 'forward', index: 1 },
				{ team: 'black', position: 'forward', index: 0 },
				{ team: 'black', position: 'forward', index: 1 }
			],
			placements: [place('a', 'white', 'forward'), place('b', 'white', 'forward')],
			pool: [
				candidate('a', 'forward', 5),
				candidate('b', 'forward', 5),
				candidate('c', 'forward', 4),
				candidate('d', 'forward', 4)
			],
			rules
		});

		expect(suggestions.map((suggestion) => suggestion.slot.team)).toEqual(['black', 'black']);
	});

	it('never adds a soft violation to an otherwise legal lineup', () => {
		const suggestions = fillSuggestions({
			openSlots: [{ team: 'white', position: 'forward', index: 1 }],
			placements: [place('a', 'white', 'forward')],
			pool: [
				candidate('a', 'forward', 5),
				candidate('b', 'forward', 4),
				candidate('c', 'forward', 3)
			],
			rules: [rule('soft', 'a', 'b', 'must_not', false)]
		});

		expect(suggestions.map((suggestion) => suggestion.playerId)).toEqual(['c']);
	});
});
