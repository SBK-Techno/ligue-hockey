import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rinkRole } from '#config/rink.ts';
import { TEAMS } from '#config/teams.ts';
import type { GameSlotView } from '#lib/domain/games/types.ts';
import { t } from '#lib/shared/i18n/index.ts';
import {
	assignmentsForSave,
	benchKey,
	benchPlayerId,
	boardPlacements,
	clearSelectedPlace,
	initialAssignments,
	placeFromBench,
	removePlayer,
	selectBenchPlayer,
	selectPlace,
	slotAriaLabel,
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

	it('projette les places hors glace, même vides', () => {
		const placements = boardPlacements([
			...slots,
			slot('black', 'goalie', 1, null)
		]);

		expect(placements.at(-1)).toMatchObject({ role: null, playerId: null });
		expect(
			slotAriaLabel('black', placements.at(-1)!, null)
		).toContain(t('rink.extraSlot', { index: 2 }));
	});

	it('contient le texte visible du jeton dans son nom accessible', () => {
		const label = slotAriaLabel(
			'white',
			{ position: 'forward', slotIndex: 0, role: rinkRole('forward', 0) },
			{ jerseyNumber: 22, fullName: 'Karim Haddad' }
		);

		expect(label).toContain('22 Haddad');
		expect(label).toContain('Karim Haddad');
	});

	it('donne un nom accessible distinct à chaque place de la glace', () => {
		const names = new Set<string>();
		for (const team of TEAMS) {
			for (const position of ['forward', 'defense'] as const) {
				for (let slotIndex = 0; slotIndex < 8; slotIndex += 1) {
					names.add(
						slotAriaLabel(
							team.key,
							{ position, slotIndex, role: rinkRole(position, slotIndex) },
							null
						)
					);
				}
			}
			names.add(
				slotAriaLabel(
					team.key,
					{ position: 'goalie', slotIndex: 0, role: rinkRole('goalie', 0) },
					null
				)
			);
		}

		expect(names.size).toBe(TEAMS.length * 17);
		const labels = [...names];
		expect(labels.some((label) => label.includes(t('rink.line', { line: 2 })))).toBe(true);
		expect(labels.some((label) => label.includes(t('rink.pair', { pair: 2 })))).toBe(true);
	});
});

describe('lisibilité des jetons sur la glace', () => {
	const css = readFileSync('src/routes/layout.css', 'utf8');
	// La première règle `.rink-name` porte la base; la seconde, sous 640 px,
	// retire le nom au profit du numéro. On borne chaque lecture à son bloc
	// pour ne pas confondre la base avec la règle mobile.
	const baseStart = css.indexOf('.rink-name {');
	const mediaStart = css.indexOf('@media (max-width: 639px)', baseStart);
	const base = css.slice(baseStart, mediaStart);
	const small = css.slice(mediaStart, css.indexOf('.rink-empty {', mediaStart));

	it('tronque le nom au complet sans insérer de trait d’union', () => {
		expect(base).toContain('hyphens: none');
		expect(base).not.toContain('hyphens: auto');
		expect(base).toContain('text-overflow: ellipsis');
		expect(base).toContain('white-space: nowrap');
	});

	it('passe au numéro seul sur un jeton de 44 px', () => {
		expect(small).toMatch(/\.rink-name[\s\S]{0,40}display: none/);
	});
});

describe('sélection de la carte', () => {
	it('encode et décode la clé du banc', () => {
		expect(benchKey('d')).toBe('bench:d');
		expect(benchPlayerId(benchKey('d'))).toBe('d');
		expect(benchPlayerId('white:forward:0')).toBeNull();
	});

	it('choisit une place occupée, puis la relâche au second clic', () => {
		const assignments = initialAssignments(slots);
		const selected = selectPlace({ selected: null, assignments }, 'white:forward:0');
		expect(selected).toEqual({ selected: 'white:forward:0', assignments });

		expect(selectPlace(selected, 'white:forward:0')).toEqual({
			selected: null,
			assignments
		});
	});

	it('ne sélectionne jamais une place vide', () => {
		expect(
			selectPlace(
				{ selected: null, assignments: initialAssignments(slots) },
				'black:goalie:0'
			)
		).toEqual({ selected: null, assignments: initialAssignments(slots) });
	});

	it('pose un joueur du banc sur une place et vide sa sélection', () => {
		const state = selectBenchPlayer(
			{ selected: null, assignments: initialAssignments(slots) },
			'd'
		);
		expect(state.selected).toBe('bench:d');

		const placed = selectPlace(state, 'white:forward:0');
		expect(placed.selected).toBeNull();
		expect(placed.assignments['white:forward:0']).toBe('d');
		expect(Object.values(placed.assignments)).not.toContain('a');
	});

	it('échange deux joueurs sélectionnés l’un après l’autre', () => {
		const first = selectPlace(
			{ selected: null, assignments: initialAssignments(slots) },
			'white:forward:0'
		);
		const swapped = selectPlace(first, 'black:forward:0');
		expect(swapped.assignments['white:forward:0']).toBe('c');
		expect(swapped.assignments['black:forward:0']).toBe('a');
	});

	it('retire le joueur sélectionné et ignore une sélection de banc', () => {
		const removed = clearSelectedPlace({
			selected: 'white:forward:1',
			assignments: initialAssignments(slots)
		});
		expect(removed.assignments['white:forward:1']).toBeNull();
		expect(removed.selected).toBeNull();

		const bench = { selected: benchKey('d'), assignments: initialAssignments(slots) };
		expect(clearSelectedPlace(bench)).toBe(bench);
		expect(clearSelectedPlace({ selected: null, assignments: initialAssignments(slots) }).selected).toBeNull();
	});
});
