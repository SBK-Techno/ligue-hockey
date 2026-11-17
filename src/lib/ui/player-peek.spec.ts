import { describe, expect, it } from 'vitest';
import {
	isPeekSheet,
	peekPlacement,
	type PeekAnchor
} from './player-peek.ts';

const anchor: PeekAnchor = {
	top: 100,
	left: 300,
	width: 40,
	height: 40,
	bottom: 140,
	right: 340
};
const desktop = { width: 1200, height: 800 };

describe('placement de la fiche joueur', () => {
	it('se pose sous la cible quand il y a de la place', () => {
		expect(peekPlacement(anchor, desktop)).toMatchObject({ top: 148, left: 148, width: 344 });
	});

	it('bascule au-dessus quand le bas manque de place', () => {
		const bottom = { ...anchor, top: 600, bottom: 640 };
		expect(peekPlacement(bottom, desktop).top).toBe(172);
	});

	it('reste dans la fenêtre sur les deux axes', () => {
		const corner = { ...anchor, left: 1180, right: 1220 };
		const placement = peekPlacement(corner, desktop);
		expect(placement.left).toBe(848);
		expect(placement.left + placement.width).toBeLessThanOrEqual(1200);
		expect(placement.top).toBeGreaterThanOrEqual(8);
	});

	it('réduit la largeur sur un écran étroit', () => {
		expect(peekPlacement(anchor, { width: 360, height: 700 }).width).toBe(344);
		expect(peekPlacement(anchor, { width: 300, height: 700 }).width).toBe(284);
	});

	it('ne remonte jamais au-dessus de la marge', () => {
		expect(peekPlacement(anchor, { width: 1200, height: 300 }).top).toBe(8);
	});

	it('passe en feuille sous 640 px', () => {
		expect(isPeekSheet(639)).toBe(true);
		expect(isPeekSheet(640)).toBe(false);
	});
});
