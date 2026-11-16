import { describe, expect, it } from 'vitest';
import type { Position } from '#config/positions.ts';
import type { GeneratorPlayer, GeneratorRule } from './generator.ts';
import {
	balanceView,
	bestSwap,
	fillSuggestions,
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

function place(
	id: string,
	team: 'white' | 'black',
	position: Position
): Placement {
	return { playerId: id, team, position };
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
			[place('a', 'white', 'forward'), place('b', 'white', 'forward'), place('c', 'black', 'forward'), place('d', 'black', 'forward')],
			players
		);

		expect(view.skillDiff).toBe(1);
		expect(view.ageDiff).toBe(10);
		expect(view.sizeDiff).toBe(0);
		expect(view.totals.white.skillAverage).toBe(4);
		expect(view.totals.black.skillAverage).toBe(3);
	});

	it('ignores players missing from the pool instead of inventing a rating', () => {
		const view = balanceView([place('missing', 'white', 'forward')], []);

		expect(view.totals.white.count).toBe(0);
		expect(view.skillDiff).toBe(0);
	});
});

describe('bestSwap', () => {
	it('suggests the same-position swap that evens the teams', () => {
		const players = [
			player('a', 'forward', 5),
			player('b', 'forward', 3),
			player('c', 'forward', 4),
			player('d', 'forward', 2)
		];
		const suggestion = bestSwap({
			placements: [
				place('a', 'white', 'forward'),
				place('b', 'white', 'forward'),
				place('c', 'black', 'forward'),
				place('d', 'black', 'forward')
			],
			players,
			rules: []
		});

		expect(suggestion).toMatchObject({
			playerAId: 'a',
			playerBId: 'c',
			position: 'forward',
			skillDiffBefore: 1,
			skillDiffAfter: 0
		});
	});

	it('returns nothing when the teams are already close enough', () => {
		const suggestion = bestSwap({
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
			rules: []
		});

		expect(suggestion).toBeNull();
	});

	it('falls back to the best legal swap when the even swaps are forbidden', () => {
		// Échanger a et c, ou b et d, ramène l'écart à zéro, mais les deux
		// placent une paire interdite ensemble. L'échange légal suivant doit
		// être proposé, avec un écart plus grand.
		const rule: GeneratorRule = {
			id: 'r1',
			playerAId: 'a',
			playerBId: 'd',
			kind: 'must_not',
			strict: true
		};
		const suggestion = bestSwap({
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
			rules: [rule]
		});

		expect(suggestion?.skillDiffAfter).toBe(1);
		expect(suggestion?.skillDiffBefore).toBe(2);
	});

	it('only swaps players who play the same position', () => {
		const suggestion = bestSwap({
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
			rules: []
		});

		expect(suggestion).toBeNull();
	});
});

describe('fillSuggestions', () => {
	const rules: GeneratorRule[] = [];

	it('fills an open slot with the available player who balances best', () => {
		const suggestions = fillSuggestions({
			openSlots: [{ team: 'black', position: 'forward', index: 1 }],
			placements: [
				place('a', 'white', 'forward'),
				place('b', 'black', 'forward')
			],
			pool: [
				player('a', 'forward', 5),
				player('b', 'forward', 2),
				player('strong', 'forward', 5),
				player('weak', 'forward', 1)
			],
			rules
		});

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0].playerId).toBe('strong');
	});

	it('never puts a skater in a goalie slot', () => {
		const suggestions = fillSuggestions({
			openSlots: [{ team: 'white', position: 'goalie', index: 0 }],
			placements: [],
			pool: [player('f', 'forward', 4)],
			rules
		});

		expect(suggestions).toEqual([]);
	});

	it('uses each available player only once', () => {
		const suggestions = fillSuggestions({
			openSlots: [
				{ team: 'white', position: 'forward', index: 1 },
				{ team: 'black', position: 'forward', index: 1 }
			],
			placements: [
				place('a', 'white', 'forward'),
				place('b', 'black', 'forward')
			],
			pool: [
				player('a', 'forward', 5),
				player('b', 'forward', 2),
				player('only', 'forward', 4)
			],
			rules
		});

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0].playerId).toBe('only');
	});

	it('leaves a slot open rather than breaking a pair rule', () => {
		const suggestions = fillSuggestions({
			openSlots: [{ team: 'white', position: 'forward', index: 1 }],
			placements: [place('a', 'white', 'forward')],
			pool: [player('a', 'forward', 5), player('b', 'forward', 4)],
			rules: [
				{
					id: 'r1',
					playerAId: 'a',
					playerBId: 'b',
					kind: 'must_not',
					strict: true
				}
			]
		});

		expect(suggestions).toEqual([]);
	});
});
