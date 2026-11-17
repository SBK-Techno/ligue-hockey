import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { settingBound } from '#config/settings-registry.ts';
import {
	RINK,
	rinkGeometryStyle,
	rinkLengthPercent,
	rinkLineVariables,
	rinkRole
} from '#config/rink.ts';

/** Les places de glace suivent les bornes des réglages, jamais un 8 recopié. */
const SUPPORTED_SLOTS = {
	forward: settingBound('roster.forwardsPerTeam', 'max'),
	defense: settingBound('roster.defensePerTeam', 'max'),
	goalie: settingBound('roster.goaliesPerTeam', 'max')
} as const;

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
		expect(RINK.cornerRadius * 2).toBeLessThan(RINK.width);
		expect(RINK.crease).toBeLessThan(RINK.goalLine);
		expect(RINK.goalieDepth).toBeGreaterThan(RINK.goalLine + RINK.crease);
		expect(RINK.goalieDepth).toBeLessThan(RINK.blueLine);

		const lines = rinkLineVariables();
		expect(lines.center).toBe('50%');
		expect(lines.blueLeft).toBe(percentOfLength(RINK.blueLine));
		expect(lines.blueRight).toBe(percentOfLength(RINK.length - RINK.blueLine));
		expect(lines.goalLeft).toBe(percentOfLength(RINK.goalLine));
		expect(lines.goalRight).toBe(percentOfLength(RINK.length - RINK.goalLine));
	});

	it('aligne la première ligne et la première paire sur les lignes peintes', () => {
		const ownBlue = rinkLengthPercent(RINK.blueLine);
		const enemyBlue = rinkLengthPercent(RINK.length - RINK.blueLine);
		const goalie = rinkLengthPercent(RINK.goalieDepth);

		expect(rinkRole('forward', 0)).toMatchObject({ key: 'C', x: 50, y: 50 });
		expect(rinkRole('forward', 1)).toMatchObject({ key: 'LW', x: 23, y: enemyBlue });
		expect(rinkRole('forward', 2)).toMatchObject({ key: 'RW', x: 77, y: enemyBlue });
		expect(rinkRole('defense', 0)).toMatchObject({ key: 'LD', x: 26, y: ownBlue });
		expect(rinkRole('defense', 1)).toMatchObject({ key: 'RD', x: 74, y: ownBlue });
		expect(rinkRole('goalie', 0)).toMatchObject({ key: 'G', x: 50, y: goalie });
		expect(goalie).toBe(89);
	});

	it('donne une coordonnée unique à chaque place soutenue par les réglages', () => {
		for (const position of ['forward', 'defense'] as const) {
			const roles = Array.from({ length: SUPPORTED_SLOTS[position] }, (_, index) =>
				rinkRole(position, index)
			);
			expect(roles.every((role) => role !== null)).toBe(true);
			const coordinates = roles.map((role) => `${role!.x},${role!.y}`);
			expect(new Set(coordinates).size).toBe(SUPPORTED_SLOTS[position]);
			expect(new Set(roles.map((role) => role!.key)).size).toBe(
				position === 'forward' ? 3 : 2
			);
		}
	});

	it('associe chaque place de forward au bon trio et chaque défenseur à la bonne paire', () => {
		for (let index = 0; index < SUPPORTED_SLOTS.forward; index += 1) {
			expect(rinkRole('forward', index)?.line).toBe(Math.floor(index / 3) + 1);
		}
		for (let index = 0; index < SUPPORTED_SLOTS.defense; index += 1) {
			expect(rinkRole('defense', index)?.pair).toBe(Math.floor(index / 2) + 1);
		}
	});

	it('place chaque index soutenu par les réglages et garde les gardiens de trop hors glace', () => {
		for (const position of ['forward', 'defense', 'goalie'] as const) {
			const supported =
				position === 'goalie' ? 1 : SUPPORTED_SLOTS[position];
			for (let index = 0; index < supported; index += 1) {
				expect(rinkRole(position, index), `${position} ${index}`).not.toBeNull();
			}
			expect(rinkRole(position, supported), `${position} ${supported}`).toBeNull();
		}
		for (let index = 1; index < SUPPORTED_SLOTS.goalie; index += 1) {
			expect(rinkRole('goalie', index)).toBeNull();
		}
		expect(rinkRole('forward', -1)).toBeNull();
		expect(rinkRole('forward', 1.5)).toBeNull();
	});

	it('dérive les lignes peintes des mesures, sans pourcentage recopié', () => {
		expect(rinkLineVariables()).toEqual({
			center: '50%',
			blueLeft: percentOfLength(RINK.blueLine),
			blueRight: percentOfLength(RINK.length - RINK.blueLine),
			goalLeft: percentOfLength(RINK.goalLine),
			goalRight: percentOfLength(RINK.length - RINK.goalLine)
		});

		const shifted = rinkLineVariables({ ...RINK, blueLine: 30, goalLine: 6 });
		expect(shifted.blueLeft).toBe('50%');
		expect(shifted.goalLeft).toBe('10%');
	});

	it('ancre le portrait sur la coordonnée exacte, sans borne en pixels', () => {
		const css = readFileSync('src/routes/layout.css', 'utf8');
		const tokenBlock = css.slice(
			css.indexOf('.rink-token {'),
			css.indexOf('.rink-token:focus-visible')
		);

		expect(tokenBlock).toContain('--rink-face-size: clamp(3rem, 14cqi, 4rem)');
		expect(tokenBlock).toContain(
			'top: calc(var(--y) - var(--rink-face-size) * 0.5)'
		);
		expect(tokenBlock).toContain('left: var(--x)');
		expect(tokenBlock).toContain('transform: translateX(-50%)');
		expect(tokenBlock).not.toContain('clamp(2.5rem, var(--y)');
		expect(tokenBlock).not.toContain('clamp(2.5rem, var(--x)');
	});

	it('garde la formation sous 440 px avec des pastilles de 44 px', () => {
		const css = readFileSync('src/routes/layout.css', 'utf8');
		const start = css.indexOf('@container (max-width: 439px)');
		const compact = css.slice(start, css.indexOf('.avatar-picker', start));

		expect(start).toBeGreaterThan(0);
		expect(compact).toContain('--rink-face-size: 2.75rem');
		expect(compact).toContain('.rink-name');
		expect(compact).toContain('display: none');
		expect(css).not.toContain('@container (max-width: 559px)');
	});

	it('transmet la géométrie par les variables CSS consommées par la glace', () => {
		const style = rinkGeometryStyle();
		expect(style).toContain(`--rink-blue-left: ${percentOfLength(RINK.blueLine)}`);
		expect(style).toContain('--rink-center: 50%');
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
			'--rink-goal-right'
		]) {
			expect(rinkBlock).toContain(`var(${variable})`);
		}
		expect(rinkBlock).not.toContain('24.7%');
		expect(rinkBlock).not.toContain('49.7%');
		expect(rinkBlock).not.toContain('width: 22%');
		expect(css).not.toContain('.rink::after');
	});
});
