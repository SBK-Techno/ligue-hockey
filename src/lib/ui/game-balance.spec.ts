import { describe, expect, it } from 'vitest';
import { balanceLine } from './game-balance.ts';

describe('ligne d’équilibre', () => {
	it('omet un écart de notes non mesuré, sans laisser de libellé suspendu', () => {
		expect(balanceLine(null, '0,0')).toBe('Écart d’âge cumulé : 0,0 ans');
		expect(balanceLine(null, '0,0')).not.toContain('Écart de notes');
	});

	it('garde les deux écarts quand ils existent', () => {
		expect(balanceLine('0,25', '1,0')).toBe(
			'Écart de notes : 0,25 · Écart d’âge cumulé : 1,0 ans'
		);
	});

	it('n’affiche que l’écart mesuré', () => {
		expect(balanceLine('0,25', null)).toBe('Écart de notes : 0,25');
	});

	it('reste vide quand rien n’est mesuré', () => {
		expect(balanceLine(null, null)).toBe('');
	});
});
