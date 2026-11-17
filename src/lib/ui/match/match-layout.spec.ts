import { describe, expect, it } from 'vitest';
import { matchSectionOrder, type MatchSectionState } from './match-layout.ts';

const state = (overrides: Partial<MatchSectionState> = {}): MatchSectionState => ({
	completed: false,
	hasAttendance: true,
	hasSubstitutes: true,
	hasSheet: false,
	...overrides
});

describe('ordre des sections d’un match', () => {
	const cases = [
		{
			name: 'un match à venir commence par la présence puis les remplaçants',
			state: state(),
			expected: ['attendance', 'substitutes']
		},
		{
			name: 'un match à venir sans remplaçants garde la présence',
			state: state({ hasSubstitutes: false }),
			expected: ['attendance']
		},
		{
			name: 'un match à venir sans présence montre les remplaçants',
			state: state({ hasAttendance: false }),
			expected: ['substitutes']
		},
		{
			name: 'un match commencé commence par la feuille et le score',
			state: state({ hasSheet: true }),
			expected: ['sheet', 'substitutes']
		},
		{
			name: 'un match terminé commence par la feuille et le score',
			state: state({ completed: true, hasSheet: true }),
			expected: ['sheet', 'substitutes']
		},
		{
			name: 'un match terminé sans feuille garde les remplaçants',
			state: state({ completed: true }),
			expected: ['substitutes']
		},
		{
			name: 'un match terminé sans historique de remplaçants n’affiche que la feuille',
			state: state({ completed: true, hasSheet: true, hasSubstitutes: false }),
			expected: ['sheet']
		},
		{
			name: 'la présence verrouillée d’un match terminé est omise',
			state: state({ completed: true, hasSheet: true, hasAttendance: false }),
			expected: ['sheet', 'substitutes']
		},
		{
			name: 'un match sans aucune section ne rend aucun panneau',
			state: state({ hasAttendance: false, hasSubstitutes: false }),
			expected: []
		}
	] as const;

	for (const entry of cases) {
		it(entry.name, () => {
			expect(matchSectionOrder(entry.state)).toEqual(entry.expected);
		});
	}
});
