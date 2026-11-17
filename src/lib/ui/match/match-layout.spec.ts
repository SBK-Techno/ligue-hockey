import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchSectionOrder, type MatchSectionState } from './match-layout.ts';

const state = (overrides: Partial<MatchSectionState> = {}): MatchSectionState => ({
	completed: false,
	hasAttendance: true,
	hasSubstitutes: true,
	hasSheet: true,
	hasLineup: true,
	...overrides
});

describe('ordre des sections d’un match', () => {
	const cases = [
		{
			name: 'un match à venir commence par la présence',
			state: state(),
			expected: ['attendance', 'substitutes', 'sheet', 'lineup']
		},
		{
			name: 'un match sans feuille de match garde l’alignement à la fin',
			state: state({ hasSheet: false }),
			expected: ['attendance', 'substitutes', 'lineup']
		},
		{
			name: 'un match terminé commence par la feuille et le score',
			state: state({ completed: true }),
			expected: ['sheet', 'lineup', 'substitutes']
		},
		{
			name: 'un match terminé sans feuille garde l’alignement en tête',
			state: state({ completed: true, hasSheet: false }),
			expected: ['lineup', 'substitutes']
		},
		{
			name: 'un match terminé sans historique de remplaçants n’affiche pas leur panneau',
			state: state({ completed: true, hasSubstitutes: false }),
			expected: ['sheet', 'lineup']
		},
		{
			name: 'un match terminé sans alignement ne montre pas de panneau vide',
			state: state({ completed: true, hasLineup: false, hasSubstitutes: false }),
			expected: ['sheet']
		},
		{
			name: 'la présence verrouillée d’un match terminé est omise',
			state: state({ completed: true, hasAttendance: false }),
			expected: ['sheet', 'lineup', 'substitutes']
		}
	] as const;

	for (const entry of cases) {
		it(entry.name, () => {
			expect(matchSectionOrder(entry.state)).toEqual(entry.expected);
		});
	}
});

describe('une seule présentation par fait', () => {
	const page = readFileSync('src/routes/matchs/[id]/+page.svelte', 'utf8');

	it('n’affiche l’avis d’annulation qu’au niveau de la page', () => {
		expect(page.match(/games\.cancelledNotice/g)).toHaveLength(1);
	});

	it('laisse le banc à la carte d’alignement', () => {
		expect(page).not.toContain("t('games.bench')");
	});
});
