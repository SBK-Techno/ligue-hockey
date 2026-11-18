import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rinkRole } from '#config/rink.ts';
import { TEAMS, type Team } from '#config/teams.ts';
import type { GamePlayer, GameSlotView } from '#lib/domain/games/types.ts';
import { t } from '#lib/shared/i18n/index.ts';
import {
	assignmentsAllowed,
	assignmentsForSave,
	benchForSave,
	benchKey,
	benchPlayerId,
	boardPlacements,
	clearSelectedPlace,
	dropOnPlace,
	initialAssignments,
	initialBenchTeams,
	placeFromBench,
	placementRules,
	removePlayer,
	rinkRoleShortLabel,
	selectBenchPlayer,
	selectPlace,
	slotAriaLabel,
	swapPlayers,
	viewerSpot,
	type LineupAssignmentMap,
	type LineupSelection
} from './lineup-board.ts';

function selection(
	selected: string | null,
	assignments: LineupAssignmentMap,
	benchTeams: Record<string, Team> = {}
): LineupSelection {
	return { selected, assignments, benchTeams };
}

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

function benchEntry(
	playerId: string,
	position: 'forward' | 'defense' | 'goalie'
): GamePlayer {
	return {
		playerId,
		fullName: `${playerId} Test`,
		position,
		jerseyNumber: 10,
		avatarId: null,
		kind: 'regular'
	};
}

const slots = [
	slot('white', 'forward', 0, 'a'),
	slot('white', 'forward', 1, 'b'),
	slot('white', 'forward', 2, null),
	slot('white', 'defense', 0, null),
	slot('black', 'forward', 0, 'c'),
	slot('black', 'defense', 0, 'e'),
	slot('black', 'goalie', 0, 'g')
];

const bench = [
	benchEntry('d', 'forward'),
	benchEntry('f', 'defense'),
	benchEntry('h', 'goalie')
];

const players = [
	...slots.flatMap((entry) => (entry.player ? [entry.player] : [])),
	...bench
];

const rules = placementRules(slots, players);

describe('carte d’alignement', () => {
	it('part de l’alignement publié, places vides comprises', () => {
		expect(initialAssignments(slots)).toEqual({
			'white:forward:0': 'a',
			'white:forward:1': 'b',
			'white:forward:2': null,
			'white:defense:0': null,
			'black:forward:0': 'c',
			'black:defense:0': 'e',
			'black:goalie:0': 'g'
		});
	});

	it('échange deux joueurs sans en perdre un', () => {
		const swapped = swapPlayers(
			initialAssignments(slots),
			'white:forward:0',
			'black:forward:0',
			rules
		);

		expect(swapped['white:forward:0']).toBe('c');
		expect(swapped['black:forward:0']).toBe('a');
		expect(Object.values(swapped).filter(Boolean)).toHaveLength(5);
	});

	it('pose un joueur du banc sur une place occupée et renvoie l’ancien au banc', () => {
		const placed = placeFromBench(
			initialAssignments(slots),
			'd',
			'white:forward:0',
			rules
		);

		expect(placed['white:forward:0']).toBe('d');
		expect(Object.values(placed)).not.toContain('a');
	});

	it('déplace un joueur déjà sur la glace vers une place vide', () => {
		const moved = placeFromBench(
			initialAssignments(slots),
			'a',
			'white:forward:2',
			rules
		);

		expect(moved['white:forward:2']).toBe('a');
		expect(moved['white:forward:0']).toBeNull();
	});

	it('retire un joueur sans toucher aux autres', () => {
		const removed = removePlayer(initialAssignments(slots), 'white:forward:1');

		expect(removed['white:forward:1']).toBeNull();
		expect(removed['white:forward:0']).toBe('a');
	});

	it('refuse une place inconnue au lieu de créer une clé', () => {
		const map = initialAssignments(slots);

		expect(swapPlayers(map, 'white:forward:0', 'nope', rules)).toBe(map);
		expect(placeFromBench(map, 'd', 'nope', rules)).toBe(map);
	});

	it('produit une formation complète, places vides comprises', () => {
		expect(assignmentsForSave(slots, initialAssignments(slots))).toEqual([
			{ team: 'white', position: 'forward', slotIndex: 0, playerId: 'a' },
			{ team: 'white', position: 'forward', slotIndex: 1, playerId: 'b' },
			{ team: 'white', position: 'forward', slotIndex: 2, playerId: null },
			{ team: 'white', position: 'defense', slotIndex: 0, playerId: null },
			{ team: 'black', position: 'forward', slotIndex: 0, playerId: 'c' },
			{ team: 'black', position: 'defense', slotIndex: 0, playerId: 'e' },
			{ team: 'black', position: 'goalie', slotIndex: 0, playerId: 'g' }
		]);

		const filled = { ...initialAssignments(slots), 'white:forward:2': 'd' };
		expect(
			assignmentsForSave(slots, filled).find(
				(assignment) =>
					assignment.team === 'white' &&
					assignment.position === 'forward' &&
					assignment.slotIndex === 2
			)
		).toEqual({
			team: 'white',
			position: 'forward',
			slotIndex: 2,
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
	const baseStart = css.indexOf('.rink-name {');
	const base = css.slice(baseStart, css.indexOf('.rink-empty {', baseStart));

	it('garde le nom entier et ne coupe qu’au trait d’union existant', () => {
		expect(base).toContain('hyphens: manual');
		expect(base).not.toContain('hyphens: auto');
		expect(base).not.toContain('text-overflow: ellipsis');
		expect(base).toContain('white-space: normal');
		expect(base).toContain('overflow-wrap: normal');
	});

	it('garde le nom entier; une glace étroite le confie à la liste nommée', () => {
		expect(base).not.toContain('display: none');
	});

	it('affiche une seule équipe et une liste nommée sous 640 px', () => {
		const mobile = css.slice(css.indexOf('@media (max-width: 639px)', css.indexOf('.rink-switch')));

		expect(mobile).toContain(".rink-team[data-active='false']");
		expect(mobile).toContain('.rink-roster');
		expect(mobile).toContain('display: block');
	});
});

describe('place du joueur connecté', () => {
	const benchPlayer = {
		playerId: 'd',
		fullName: 'D Test',
		position: 'defense' as const,
		jerseyNumber: 4,
		avatarId: null,
		kind: 'regular' as const
	};

	it('ne décrit rien sans joueur connecté', () => {
		expect(viewerSpot(slots, [benchPlayer], null)).toBeNull();
	});

	it('décrit une place sur la glace avec son trio', () => {
		expect(viewerSpot(slots, [], 'a')).toEqual({
			kind: 'slot',
			team: 'white',
			position: 'forward',
			slotIndex: 0,
			role: 'C',
			line: 1,
			pair: null
		});
	});

	it('décrit une place de défenseur avec sa paire', () => {
		const defense = slot('white', 'defense', 2, 'e');
		expect(viewerSpot([defense], [], 'e')).toMatchObject({
			kind: 'slot',
			position: 'defense',
			role: 'LD',
			line: null,
			pair: 2
		});
	});

	it('reconnaît un joueur sur le banc', () => {
		expect(viewerSpot(slots, [benchPlayer], 'd')).toEqual({ kind: 'bench', team: null });
	});

	it('nomme l’équipe d’un joueur sur le banc habillé', () => {
		expect(viewerSpot(slots, [{ ...benchPlayer, team: 'black' }], 'd')).toEqual({
			kind: 'bench',
			team: 'black'
		});
	});

	it('signale un joueur absent de la formation publiée', () => {
		expect(viewerSpot(slots, [benchPlayer], 'absent')).toEqual({ kind: 'absent' });
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
		const selected = selectPlace(selection(null, assignments), 'white:forward:0', rules);
		expect(selected).toEqual(selection('white:forward:0', assignments));

		expect(selectPlace(selected, 'white:forward:0', rules)).toEqual(
			selection(null, assignments)
		);
	});

	it('ne sélectionne jamais une place vide', () => {
		const assignments = initialAssignments(slots);

		expect(selectPlace(selection(null, assignments), 'white:forward:2', rules)).toEqual(
			selection(null, assignments)
		);
	});

	it('pose un joueur du banc sur une place et vide sa sélection', () => {
		const state = selectBenchPlayer(selection(null, initialAssignments(slots)), 'd');
		expect(state.selected).toBe('bench:d');

		const placed = selectPlace(state, 'white:forward:0', rules);
		expect(placed.selected).toBeNull();
		expect(placed.assignments['white:forward:0']).toBe('d');
		expect(Object.values(placed.assignments)).not.toContain('a');
	});

	it('échange deux joueurs du même poste sélectionnés l’un après l’autre', () => {
		const first = selectPlace(
			selection(null, initialAssignments(slots)),
			'white:forward:0',
			rules
		);
		const swapped = selectPlace(first, 'black:forward:0', rules);
		expect(swapped.assignments['white:forward:0']).toBe('c');
		expect(swapped.assignments['black:forward:0']).toBe('a');
	});

	it('sélectionne le joueur d’une place d’un autre poste sans l’échanger', () => {
		const first = selectPlace(
			selection(null, initialAssignments(slots)),
			'white:forward:0',
			rules
		);
		const next = selectPlace(first, 'black:defense:0', rules);

		expect(next.assignments).toEqual(first.assignments);
		expect(next.selected).toBe('black:defense:0');
	});

	it('garde la sélection devant une place vide d’un autre poste', () => {
		const first = selectPlace(
			selection(null, initialAssignments(slots)),
			'white:forward:0',
			rules
		);

		expect(selectPlace(first, 'white:defense:0', rules)).toBe(first);
	});

	it('retire le joueur sélectionné vers le banc de son équipe et ignore une sélection de banc', () => {
		const removed = clearSelectedPlace(
			selection('white:forward:1', initialAssignments(slots)),
			rules
		);
		expect(removed.assignments['white:forward:1']).toBeNull();
		expect(removed.selected).toBeNull();
		expect(removed.benchTeams['b']).toBe('white');

		const bench = selection(benchKey('d'), initialAssignments(slots));
		expect(clearSelectedPlace(bench, rules)).toBe(bench);
		expect(
			clearSelectedPlace(selection(null, initialAssignments(slots)), rules).selected
		).toBeNull();
	});
});

describe('dépôt sur la glace', () => {
	const base = initialAssignments(slots);

	it('pose un joueur du banc sur une place vide de son poste', () => {
		const dropped = dropOnPlace(selection(benchKey('d'), base), 'white:forward:2', rules);

		expect(dropped.selected).toBeNull();
		expect(dropped.assignments['white:forward:2']).toBe('d');
		expect(dropped.assignments['white:forward:0']).toBe('a');
	});

	it('déplace un joueur de la glace vers une place vide de son poste', () => {
		const dropped = dropOnPlace(selection('white:forward:0', base), 'white:forward:2', rules);

		expect(dropped.assignments['white:forward:2']).toBe('a');
		expect(dropped.assignments['white:forward:0']).toBeNull();
	});

	it('échange deux joueurs quand la place est occupée', () => {
		const dropped = dropOnPlace(selection('white:forward:0', base), 'black:forward:0', rules);

		expect(dropped.assignments['white:forward:0']).toBe('c');
		expect(dropped.assignments['black:forward:0']).toBe('a');
	});

	it('refuse un gardien dans une place de défenseur', () => {
		const state = selection(benchKey('h'), base);

		expect(dropOnPlace(state, 'white:defense:0', rules)).toBe(state);
		expect(dropOnPlace(state, 'black:defense:0', rules)).toBe(state);
	});

	it('refuse un attaquant dans la place du gardien', () => {
		const state = selection('white:forward:0', base);

		expect(dropOnPlace(state, 'black:goalie:0', rules)).toBe(state);
	});

	it('refuse un échange entre deux postes', () => {
		const state = selection('white:forward:0', base);

		expect(dropOnPlace(state, 'black:defense:0', rules)).toBe(state);
	});

	it('accepte un défenseur dans une place de défenseur', () => {
		const dropped = dropOnPlace(selection(benchKey('f'), base), 'white:defense:0', rules);

		expect(dropped.assignments['white:defense:0']).toBe('f');
	});

	it('accepte le gardien dans sa place', () => {
		const dropped = dropOnPlace(selection(benchKey('h'), base), 'black:goalie:0', rules);

		expect(dropped.assignments['black:goalie:0']).toBe('h');
	});

	it('ne relâche pas la sélection en déposant sur sa propre place', () => {
		const state = selection('white:forward:0', base);

		expect(dropOnPlace(state, 'white:forward:0', rules)).toBe(state);
	});

	it('ignore une place inconnue et garde la sélection', () => {
		const state = selection('white:forward:0', base);

		expect(dropOnPlace(state, 'nope', rules)).toBe(state);
	});

	it('ignore une sélection dont la place n’existe plus', () => {
		const state = selection('white:forward:7', base);

		expect(dropOnPlace(state, 'black:forward:0', rules)).toBe(state);
	});

	it('replace un joueur du banc déjà sur la glace en échangeant sa place', () => {
		const dropped = dropOnPlace(selection(benchKey('a'), base), 'black:forward:0', rules);

		expect(dropped.assignments['black:forward:0']).toBe('a');
		expect(dropped.assignments['white:forward:0']).toBe('c');
	});
});

describe('banc habillé par équipe', () => {
	const base = initialAssignments(slots);

	it('note l’équipe de chaque joueur du banc publié', () => {
		expect(
			initialBenchTeams([
				{ ...benchEntry('d', 'forward'), team: 'white' },
				{ ...benchEntry('f', 'defense'), team: 'black' },
				benchEntry('h', 'goalie')
			])
		).toEqual({ d: 'white', f: 'black' });
	});

	it('un joueur du banc habillé ne prend qu’une place de son équipe', () => {
		const state = selection(benchKey('d'), base, { d: 'white' });

		expect(dropOnPlace(state, 'black:forward:0', rules)).toBe(state);
		const placed = dropOnPlace(state, 'white:forward:2', rules);
		expect(placed.assignments['white:forward:2']).toBe('d');
		expect(placed.benchTeams['d']).toBeUndefined();
	});

	it('un joueur hors effectif peut rejoindre l’une ou l’autre équipe', () => {
		const state = selection(benchKey('d'), base);

		expect(dropOnPlace(state, 'black:forward:0', rules).assignments['black:forward:0']).toBe('d');
	});

	it('le joueur délogé rejoint le banc de l’équipe de la place', () => {
		const state = selection(benchKey('d'), base, { d: 'white' });
		const placed = dropOnPlace(state, 'white:forward:0', rules);

		expect(placed.assignments['white:forward:0']).toBe('d');
		expect(placed.benchTeams['a']).toBe('white');
		expect(placed.benchTeams['d']).toBeUndefined();
	});

	it('n’envoie au banc que les joueurs habillés par équipe', () => {
		const benchPlayers = [benchEntry('d', 'forward'), benchEntry('h', 'goalie')];
		expect(benchForSave(benchPlayers, { d: 'white' })).toEqual([
			{ playerId: 'd', team: 'white' }
		]);
	});
});

describe('admissibilité des places', () => {
	it('accepte une formation où chaque joueur occupe son poste', () => {
		expect(assignmentsAllowed(rules, initialAssignments(slots))).toBe(true);
	});

	it('refuse une formation avec un gardien en défense', () => {
		expect(
			assignmentsAllowed(rules, {
				...initialAssignments(slots),
				'white:defense:0': 'h'
			})
		).toBe(false);
	});
});

describe('abréviations des places', () => {
	it('nomme chaque rôle avec son abréviation française', () => {
		const cases = [
			['goalie', 0, 'G'],
			['defense', 0, 'DG'],
			['defense', 1, 'DD'],
			['forward', 0, 'C'],
			['forward', 1, 'AG'],
			['forward', 2, 'AD']
		] as const;

		for (const [position, slotIndex, expected] of cases) {
			const role = rinkRole(position, slotIndex);
			expect(role, `${position}:${slotIndex}`).not.toBeNull();
			expect(rinkRoleShortLabel(role!)).toBe(expected);
		}
	});

	it('garde l’abréviation visible dans le nom accessible d’une place vide', () => {
		const role = rinkRole('forward', 1)!;
		const label = slotAriaLabel(
			'white',
			{ position: 'forward', slotIndex: 1, role },
			null
		);

		expect(label).toContain('AG');
		expect(label).toContain(t('rink.emptySlot'));
	});
});
