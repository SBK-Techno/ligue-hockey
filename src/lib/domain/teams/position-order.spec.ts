import { describe, expect, it } from 'vitest';
import {
	POSITIONS,
	comparePositionThenKind,
	positionRank,
	type Position
} from '#config/positions.ts';

const RANKED = POSITIONS.map((position, index) => [position.key, index] as const);

describe('ordre des postes', () => {
	it.each(RANKED)('donne à %s le rang %s', (position, rank) => {
		expect(positionRank(position)).toBe(rank);
	});

	it('trie chaque poste avant le suivant, pour les deux sortes de joueur', () => {
		const entries = POSITIONS.flatMap((position) =>
			(['regular', 'sub'] as const).map((kind) => ({ position: position.key, kind }))
		);
		const sorted = [...entries].sort(comparePositionThenKind);

		expect(sorted).toEqual(entries);
		expect(new Set(entries.map((entry) => positionRank(entry.position))).size).toBe(
			POSITIONS.length
		);
	});

	it('garde la sorte comme second critère à l’intérieur d’un poste', () => {
		const regular = { position: 'forward' as const, kind: 'regular' };
		const substitute = { position: 'forward' as const, kind: 'sub' };

		expect(comparePositionThenKind(regular, substitute)).toBeLessThan(0);
		expect(comparePositionThenKind(substitute, regular)).toBeGreaterThan(0);
		expect(comparePositionThenKind(regular, regular)).toBe(0);
	});

	it('place une valeur inconnue avant tous les postes connus, sans planter', () => {
		const unknown = 'unknown' as Position;

		expect(positionRank(unknown)).toBe(-1);
		expect(
			comparePositionThenKind({ position: unknown, kind: 'regular' }, { position: 'forward', kind: 'sub' })
		).toBeLessThan(0);
	});
});
