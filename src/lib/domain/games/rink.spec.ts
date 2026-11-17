import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	RINK,
	rinkGeometryStyle,
	rinkLineVariables,
	rinkRole
} from '#config/rink.ts';

/** Le pourcentage attendu vient de la mesure, jamais d'une seconde valeur. */
function percentOfLength(meters: number): string {
	return `${Number(((meters / RINK.length) * 100).toFixed(3))}%`;
}

describe('patinoire', () => {
	it('garde une patinoire cohérente sans recopier ses mesures', () => {
		const measures = Object.values(RINK);
		expect(measures.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
		expect(RINK.length).toBeGreaterThan(RINK.width);
		expect(RINK.goalLine).toBeLessThan(RINK.blueLine);
		expect(RINK.blueLine).toBeLessThan(RINK.length / 2);
		expect(RINK.faceoffSpotOffset).toBeLessThan(RINK.width / 2);
		expect(RINK.endSpot).toBeLessThan(RINK.goalLine + RINK.blueLine);
		expect(RINK.neutralSpot).toBeLessThan(RINK.blueLine);
		expect(RINK.circleRadius * 2).toBeLessThan(RINK.width);
		expect(RINK.cornerRadius * 2).toBeLessThan(RINK.width);
		expect(RINK.crease).toBeLessThan(RINK.goalLine);

		const lines = rinkLineVariables();
		expect(lines.center).toBe('50%');
		expect(lines.blueLeft).toBe(percentOfLength(RINK.blueLine));
		expect(lines.blueRight).toBe(percentOfLength(RINK.length - RINK.blueLine));
		expect(lines.goalLeft).toBe(percentOfLength(RINK.goalLine));
		expect(lines.goalRight).toBe(percentOfLength(RINK.length - RINK.goalLine));
		expect(lines.circle).toBe(percentOfLength(RINK.circleRadius * 2));
	});

	it('garde les coordonnées historiques du 3F et du 2D', () => {
		expect(rinkRole('forward', 0)).toMatchObject({ key: 'C', x: 50, y: 50 });
		expect(rinkRole('forward', 1)).toMatchObject({ key: 'LW', x: 16, y: 38 });
		expect(rinkRole('forward', 2)).toMatchObject({ key: 'RW', x: 84, y: 38 });
		expect(rinkRole('defense', 0)).toMatchObject({ key: 'LD', x: 30, y: 62 });
		expect(rinkRole('defense', 1)).toMatchObject({ key: 'RD', x: 70, y: 62 });
	});

	it('donne une coordonnée unique aux huit attaquants et aux huit défenseurs', () => {
		for (const position of ['forward', 'defense'] as const) {
			const roles = Array.from({ length: 8 }, (_, index) => rinkRole(position, index));
			expect(roles.every((role) => role !== null)).toBe(true);
			const coordinates = roles.map((role) => `${role!.x},${role!.y}`);
			expect(new Set(coordinates).size).toBe(8);
			expect(new Set(roles.map((role) => role!.key)).size).toBe(
				position === 'forward' ? 3 : 2
			);
		}
	});

	it('associe chaque place de forward au bon trio et chaque défenseur à la bonne paire', () => {
		for (let index = 0; index < 8; index += 1) {
			expect(rinkRole('forward', index)?.line).toBe(Math.floor(index / 3) + 1);
			expect(rinkRole('defense', index)?.pair).toBe(Math.floor(index / 2) + 1);
		}
	});

	it('place le gardien et renvoie les places hors glace pour les surnuméraires', () => {
		expect(rinkRole('goalie', 0)?.key).toBe('G');
		expect(rinkRole('goalie', 1)).toBeNull();
		expect(rinkRole('goalie', 2)).toBeNull();
		expect(rinkRole('forward', 8)).toBeNull();
		expect(rinkRole('defense', 8)).toBeNull();
		expect(rinkRole('forward', -1)).toBeNull();
		expect(rinkRole('forward', 1.5)).toBeNull();
	});

	it('dérive les lignes peintes des mesures, sans pourcentage recopié', () => {
		expect(rinkLineVariables()).toEqual({
			center: '50%',
			blueLeft: percentOfLength(RINK.blueLine),
			blueRight: percentOfLength(RINK.length - RINK.blueLine),
			goalLeft: percentOfLength(RINK.goalLine),
			goalRight: percentOfLength(RINK.length - RINK.goalLine),
			circle: percentOfLength(RINK.circleRadius * 2)
		});

		const shifted = rinkLineVariables({ ...RINK, blueLine: 30, goalLine: 6 });
		expect(shifted.blueLeft).toBe('50%');
		expect(shifted.goalLeft).toBe('10%');
	});

	it('transmet la géométrie par les variables CSS consommées par la glace', () => {
		const style = rinkGeometryStyle();
		expect(style).toContain(`--rink-blue-left: ${percentOfLength(RINK.blueLine)}`);
		expect(style).toContain('--rink-center: 50%');
		expect(style).toContain(`--rink-circle: ${percentOfLength(RINK.circleRadius * 2)}`);
		expect(rinkGeometryStyle({ ...RINK, blueLine: 30 })).toContain(
			'--rink-blue-left: 50%'
		);

		const css = readFileSync('src/routes/layout.css', 'utf8');
		const rinkBlock = css.slice(css.indexOf('.rink {'), css.indexOf('.rink-token {'));
		for (const variable of [
			'--rink-center',
			'--rink-blue-left',
			'--rink-blue-right',
			'--rink-goal-left',
			'--rink-goal-right',
			'--rink-circle'
		]) {
			expect(rinkBlock).toContain(`var(${variable})`);
		}
		expect(rinkBlock).not.toContain('24.7%');
		expect(rinkBlock).not.toContain('49.7%');
		expect(rinkBlock).not.toContain('width: 22%');
	});
});
