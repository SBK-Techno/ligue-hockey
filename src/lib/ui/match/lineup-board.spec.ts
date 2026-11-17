import { describe, expect, it } from 'vitest';
import type { GameSlotView } from '#lib/domain/games/types.ts';
import {
	assignmentsForSave,
	initialAssignments,
	placeFromBench,
	removePlayer,
	swapPlayers
} from './lineup-board.ts';

function slot(
	team: 'white' | 'black',
	position: 'forward' | 'defense' | 'goalie',
	slotIndex: number,
	playerId: string | null
): GameSlotView {
	return {
		team,
		position,
		slotIndex,
		player: playerId
			? {
					playerId,
					fullName: `${playerId} Test`,
					position,
					jerseyNumber: slotIndex + 1,
					avatarId: null,
					kind: 'regular'
				}
			: null
	};
}

const slots = [
	slot('white', 'forward', 0, 'a'),
	slot('white', 'forward', 1, 'b'),
	slot('black', 'forward', 0, 'c'),
	slot('black', 'goalie', 0, null)
];

describe('carte d’alignement', () => {
	it('part de l’alignement publié, places vides comprises', () => {
		expect(initialAssignments(slots)).toEqual({
			'white:forward:0': 'a',
			'white:forward:1': 'b',
			'black:forward:0': 'c',
			'black:goalie:0': null
		});
	});

	it('échange deux joueurs sans en perdre un', () => {
		const swapped = swapPlayers(initialAssignments(slots), 'white:forward:0', 'black:forward:0');

		expect(swapped['white:forward:0']).toBe('c');
		expect(swapped['black:forward:0']).toBe('a');
		expect(Object.values(swapped).filter(Boolean)).toHaveLength(3);
	});

	it('pose un joueur du banc sur une place occupée et renvoie l’ancien au banc', () => {
		const placed = placeFromBench(initialAssignments(slots), 'd', 'white:forward:0');

		expect(placed['white:forward:0']).toBe('d');
		expect(Object.values(placed)).not.toContain('a');
	});

	it('déplace un joueur déjà sur la glace vers une place vide', () => {
		const moved = placeFromBench(initialAssignments(slots), 'a', 'black:goalie:0');

		expect(moved['black:goalie:0']).toBe('a');
		expect(moved['white:forward:0']).toBeNull();
	});

	it('retire un joueur sans toucher aux autres', () => {
		const removed = removePlayer(initialAssignments(slots), 'white:forward:1');

		expect(removed['white:forward:1']).toBeNull();
		expect(removed['white:forward:0']).toBe('a');
	});

	it('refuse une place inconnue au lieu de créer une clé', () => {
		const map = initialAssignments(slots);

		expect(swapPlayers(map, 'white:forward:0', 'nope')).toBe(map);
		expect(placeFromBench(map, 'd', 'nope')).toBe(map);
	});

	it('produit une formation complète, places vides comprises', () => {
		expect(assignmentsForSave(slots, initialAssignments(slots))).toEqual([
			{ team: 'white', position: 'forward', slotIndex: 0, playerId: 'a' },
			{ team: 'white', position: 'forward', slotIndex: 1, playerId: 'b' },
			{ team: 'black', position: 'forward', slotIndex: 0, playerId: 'c' },
			{ team: 'black', position: 'goalie', slotIndex: 0, playerId: null }
		]);

		const filled = { ...initialAssignments(slots), 'black:goalie:0': 'd' };
		expect(assignmentsForSave(slots, filled).at(-1)).toEqual({
			team: 'black',
			position: 'goalie',
			slotIndex: 0,
			playerId: 'd'
		});
	});
});
