import { describe, expect, it } from 'vitest';
import { RINK, RINK_ROLES, rinkRole } from '#config/rink.ts';

describe('patinoire', () => {
	it('garde les mesures IIHF en un seul propriétaire', () => {
		expect(RINK).toEqual({
			length: 60,
			width: 30,
			goalLine: 4,
			blueLine: 22.86,
			faceoffSpotOffset: 7,
			endSpot: 6,
			neutralSpot: 1.5,
			circleRadius: 4.5,
			cornerRadius: 8.5,
			crease: 1.8
		});
	});

	it('place les six rôles de départ aux pourcentages convenus', () => {
		expect(
			Object.fromEntries(
				RINK_ROLES.map((role) => [
					role.key,
					{ x: role.x, y: role.y, line: role.line, pair: role.pair }
				])
			)
		).toEqual({
			G: { x: 50, y: 92, line: 0, pair: 0 },
			LD: { x: 30, y: 62, line: 0, pair: 1 },
			RD: { x: 70, y: 62, line: 0, pair: 1 },
			C: { x: 50, y: 50, line: 1, pair: 0 },
			LW: { x: 16, y: 38, line: 1, pair: 0 },
			RW: { x: 84, y: 38, line: 1, pair: 0 }
		});
	});

	it('associe chaque place de forward au bon trio', () => {
		const expected = ['C', 'LW', 'RW', 'C', 'LW', 'RW'];
		for (const [index, key] of expected.entries()) {
			const role = rinkRole('forward', index);
			expect(role?.key).toBe(key);
			expect(role?.line).toBe(index < 3 ? 1 : 2);
		}
	});

	it('associe chaque place de défense à la bonne paire', () => {
		const expected = ['LD', 'RD', 'LD', 'RD'];
		for (const [index, key] of expected.entries()) {
			const role = rinkRole('defense', index);
			expect(role?.key).toBe(key);
			expect(role?.pair).toBe(index < 2 ? 1 : 2);
		}
	});

	it('place le gardien et renvoie le banc pour les surnuméraires', () => {
		expect(rinkRole('goalie', 0)?.key).toBe('G');
		expect(rinkRole('goalie', 1)).toBeNull();
		expect(rinkRole('forward', 6)).toBeNull();
		expect(rinkRole('defense', 4)).toBeNull();
		expect(rinkRole('forward', -1)).toBeNull();
		expect(rinkRole('forward', 1.5)).toBeNull();
	});

	it('garde chaque coordonnée dans les bornes de pourcentage', () => {
		for (const role of RINK_ROLES) {
			expect(role.x).toBeGreaterThanOrEqual(0);
			expect(role.x).toBeLessThanOrEqual(100);
			expect(role.y).toBeGreaterThanOrEqual(0);
			expect(role.y).toBeLessThanOrEqual(100);
		}
		const goalkeeper = rinkRole('goalie', 0);
		const center = rinkRole('forward', 0);
		const leftWing = rinkRole('forward', 1);
		expect(goalkeeper!.y).toBeGreaterThan(center!.y);
		expect(center!.y).toBeGreaterThan(leftWing!.y);
	});
});
