import { describe, expect, it } from 'vitest';
import { IDENTITY_IDS } from '#config/identities.ts';
import { IDENTITY_SHEET } from '#config/identity-sheet.ts';
import { branding } from '#lib/generated/branding.ts';
import { identitySheetStyle, monogram } from './identity-display.ts';

function positionOf(identityId: string): { x: number; y: number } {
	const match = identitySheetStyle(identityId).match(
		/background-position: ([0-9.]+)% ([0-9.]+)%/
	);
	if (!match) throw new Error(`position absente pour ${identityId}`);
	return { x: Number(match[1]), y: Number(match[2]) };
}

describe('portraits dans l’interface', () => {
	it('donne une position unique à chaque identité', () => {
		const styles = new Set<string>();
		for (const identityId of IDENTITY_IDS) {
			const style = identitySheetStyle(identityId);
			expect(style).toContain(branding.identitySheet);
			expect(style).toContain(`background-size: ${IDENTITY_SHEET.columns * 100}%`);
			expect(style).toContain('background-repeat: no-repeat');
			styles.add(style);
		}
		expect(styles.size).toBe(IDENTITY_IDS.length);
	});

	it('place la première tuile en haut à gauche et la dernière en bas', () => {
		expect(positionOf(IDENTITY_IDS[0])).toEqual({ x: 0, y: 0 });

		const last = positionOf(IDENTITY_IDS.at(-1)!);
		const columns = IDENTITY_SHEET.columns;
		const rows = Math.ceil(IDENTITY_IDS.length / columns);
		expect(last.x).toBeCloseTo(((IDENTITY_IDS.length - 1) % columns) / (columns - 1) * 100);
		expect(last.y).toBeCloseTo(100);
		expect(rows).toBeGreaterThan(1);
	});

	it('garde toutes les positions dans la planche', () => {
		for (const identityId of IDENTITY_IDS) {
			const { x, y } = positionOf(identityId);
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThanOrEqual(100);
			expect(y).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThanOrEqual(100);
		}
	});

	it('garde une grille de plusieurs colonnes et rangées', () => {
		expect(IDENTITY_SHEET.columns).toBeGreaterThanOrEqual(2);
		expect(
			Math.ceil(IDENTITY_IDS.length / IDENTITY_SHEET.columns)
		).toBeGreaterThanOrEqual(2);
	});

	it('retombe sur le monogramme quand l’identité est inconnue', () => {
		expect(identitySheetStyle('identite-inconnue')).toBe('');
		expect(monogram('Jean Béliveau')).toBe('JB');
		expect(monogram('  ')).toBe('');
	});
});
