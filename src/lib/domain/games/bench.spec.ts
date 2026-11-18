import { describe, expect, it } from 'vitest';
import type { RosterTemplate } from '#config/roster.ts';
import { draftTeamBench, type DraftMember, type IceDraftPlacement } from './bench.ts';

const template: RosterTemplate = {
	forwardsPerTeam: 3,
	defensePerTeam: 2,
	goaliesPerTeam: 1,
	playersPerTeam: 11
};

function member(id: string, overall: number | null, age = 30): DraftMember {
	return { playerId: id, position: 'forward', kind: 'regular', age, overall };
}

function ice(id: string, team: 'white' | 'black', overall: number, age = 30): IceDraftPlacement {
	return { ...member(id, overall, age), team };
}

/** La formation complète sur la glace : six par équipe, donc cinq au banc. */
function fullIce(): IceDraftPlacement[] {
	return [
		...Array.from({ length: 6 }, (_, index) => ice(`w${index}`, 'white', 5)),
		...Array.from({ length: 6 }, (_, index) => ice(`b${index}`, 'black', 5))
	];
}

describe('draft du banc habillé', () => {
	it('sans effectif au-delà de la formation, tout le monde attend hors effectif', () => {
		const legacy: RosterTemplate = { forwardsPerTeam: 3, defensePerTeam: 2, goaliesPerTeam: 1 };
		const bench = draftTeamBench(legacy, [], [member('a', 5), member('b', 6)]);

		expect(bench).toHaveLength(2);
		expect(bench.every((entry) => entry.team === undefined)).toBe(true);
	});

	it('habille le banc de chaque équipe jusqu’à l’effectif configuré', () => {
		// La glace est complète (six par équipe), dix candidats : cinq par banc.
		const remaining = Array.from({ length: 10 }, (_, index) => member(`r${index}`, 5));

		const bench = draftTeamBench(template, fullIce(), remaining);

		const white = bench.filter((entry) => entry.team === 'white');
		const black = bench.filter((entry) => entry.team === 'black');
		expect(white).toHaveLength(5);
		expect(black).toHaveLength(5);
		expect(bench.every((entry) => entry.team !== undefined)).toBe(true);
	});

	it('verse le surplus hors effectif quand les deux bancs sont pleins', () => {
		const remaining = Array.from({ length: 14 }, (_, index) => member(`r${index}`, 5));

		const bench = draftTeamBench(template, fullIce(), remaining);

		expect(bench.filter((entry) => entry.team === 'white')).toHaveLength(5);
		expect(bench.filter((entry) => entry.team === 'black')).toHaveLength(5);
		expect(bench.filter((entry) => entry.team === undefined)).toHaveLength(4);
	});

	it('sert l’équipe la moins forte avec les joueurs les mieux notés', () => {
		const onIce = [ice('w1', 'white', 9), ice('b1', 'black', 3)];
		const bench = draftTeamBench(template, onIce, [member('strong', 8), member('weak', 2)]);

		const strong = bench.find((entry) => entry.playerId === 'strong');
		const weak = bench.find((entry) => entry.playerId === 'weak');
		expect(strong?.team).toBe('black');
		expect(weak?.team).toBe('white');
	});

	it('reste déterministe quel que soit l’ordre des candidats', () => {
		const remaining = [member('a', 5), member('b', 6), member('c', null), member('d', 7)];
		const forward = draftTeamBench(template, [], remaining);
		const backward = draftTeamBench(template, [], [...remaining].reverse());

		expect(forward).toEqual(backward);
	});

	it('équilibre d’abord la taille des effectifs', () => {
		const onIce = [ice('w1', 'white', 5), ice('w2', 'white', 5), ice('b1', 'black', 5)];
		const bench = draftTeamBench(template, onIce, [member('x', 5), member('y', 5)]);

		// White a déjà deux joueurs, black un : les deux nouveaux vont à black
		// pour égaliser les effectifs avant de regarder la note.
		expect(bench.filter((entry) => entry.team === 'black')).toHaveLength(2);
		expect(bench.filter((entry) => entry.team === 'white')).toHaveLength(0);
	});
});
