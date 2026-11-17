import { describe, expect, it } from 'vitest';
import { matchSectionOrder, type MatchSectionState } from './match-layout.ts';

const state = (overrides: Partial<MatchSectionState> = {}): MatchSectionState => ({
	completed: false,
	hasAttendance: true,
	hasSubstitutes: true,
	hasSheet: false,
	hasLineup: true,
	...overrides
});

describe('ordre des sections d’un match', () => {
	const cases = [
		{
			name: 'un match à venir commence par l’alignement',
			state: state(),
			expected: ['lineup', 'attendance', 'substitutes']
		},
		{
			name: 'un match à venir sans feuille ni remplaçants garde l’alignement et la présence',
			state: state({ hasSubstitutes: false }),
			expected: ['lineup', 'attendance']
		},
		{
			name: 'un match à venir sans présence montre l’alignement puis les remplaçants',
			state: state({ hasAttendance: false }),
			expected: ['lineup', 'substitutes']
		},
		{
			name: 'un match commencé commence par la feuille et le score',
			state: state({ hasSheet: true }),
			expected: ['sheet', 'lineup', 'substitutes']
		},
		{
			name: 'un match terminé commence par la feuille et le score',
			state: state({ completed: true, hasSheet: true }),
			expected: ['sheet', 'lineup', 'substitutes']
		},
		{
			name: 'un match terminé sans feuille garde l’alignement en tête',
			state: state({ completed: true }),
			expected: ['lineup', 'substitutes']
		},
		{
			name: 'un match terminé sans historique de remplaçants n’affiche pas leur panneau',
			state: state({ completed: true, hasSheet: true, hasSubstitutes: false }),
			expected: ['sheet', 'lineup']
		},
		{
			name: 'un match terminé sans alignement ne montre pas de panneau vide',
			state: state({
				completed: true,
				hasSheet: true,
				hasLineup: false,
				hasSubstitutes: false
			}),
			expected: ['sheet']
		},
		{
			name: 'la présence verrouillée d’un match terminé est omise',
			state: state({ completed: true, hasSheet: true, hasAttendance: false }),
			expected: ['sheet', 'lineup', 'substitutes']
		},
		{
			name: 'un match à venir sans alignement ne montre pas de panneau vide',
			state: state({ hasLineup: false, hasAttendance: false, hasSubstitutes: false }),
			expected: []
		}
	] as const;

	for (const entry of cases) {
		it(entry.name, () => {
			expect(matchSectionOrder(entry.state)).toEqual(entry.expected);
		});
	}
});
