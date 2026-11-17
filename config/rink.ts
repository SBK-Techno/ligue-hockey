import type { Position } from './positions.ts';
import type { I18nKey } from './i18n/fr.ts';

/**
 * Patinoire IIHF de 60 m sur 30 m. Toutes les mesures sont en mètres et
 * décrivent la surface de jeu, pas une patinoire de la LNH.
 */
export const RINK = {
	length: 60,
	width: 30,
	/** Distance entre la ligne de but et la bande derrière le filet. */
	goalLine: 4,
	/** Distance entre la ligne bleue et la bande derrière le filet. */
	blueLine: 22.86,
	/** Décalage latéral des cercles d'engagement en zone. */
	faceoffSpotOffset: 7,
	/** Point d'engagement en zone, à 6 m de la ligne de but. */
	endSpot: 6,
	/** Point d'engagement neutre, à 1,5 m de la ligne bleue. */
	neutralSpot: 1.5,
	circleRadius: 4.5,
	cornerRadius: 8.5,
	/** Profondeur du demi-cercle du gardien. */
	crease: 1.8
} as const;

export type RinkRoleKey = 'G' | 'LD' | 'RD' | 'C' | 'LW' | 'RW';

export type RinkRoleDefinition = {
	key: RinkRoleKey;
	labelKey: I18nKey;
	/** Portrait, attaque vers le haut : x de 0 à 100 de gauche à droite. */
	x: number;
	/** Portrait, attaque vers le haut : y de 0 à 100 de haut en bas. */
	y: number;
	/** Trio de l'attaquant ou du gardien; 0 quand la notion ne s'applique pas. */
	line: number;
	/** Paire de défenseurs; 0 quand la notion ne s'applique pas. */
	pair: number;
};

export type RinkPlacement = RinkRoleDefinition & {
	position: Position;
	slotIndex: number;
};

/**
 * Chaque place d'attaque et de défense soutenue par les réglages (jusqu'à
 * 8F et 8D) a sa propre coordonnée. Deux jetons ne partagent jamais top/left :
 * le dernier nœud du DOM ne peut donc pas voler le clic du premier. La
 * première ligne et la première paire gardent les coordonnées historiques.
 */
export const RINK_PLACEMENTS = [
	{
		position: 'forward',
		slotIndex: 0,
		key: 'C',
		labelKey: 'rink.center',
		x: 50,
		y: 50,
		line: 1,
		pair: 0
	},
	{
		position: 'forward',
		slotIndex: 1,
		key: 'LW',
		labelKey: 'rink.leftWing',
		x: 16,
		y: 38,
		line: 1,
		pair: 0
	},
	{
		position: 'forward',
		slotIndex: 2,
		key: 'RW',
		labelKey: 'rink.rightWing',
		x: 84,
		y: 38,
		line: 1,
		pair: 0
	},
	{
		position: 'forward',
		slotIndex: 3,
		key: 'C',
		labelKey: 'rink.center',
		x: 50,
		y: 64,
		line: 2,
		pair: 0
	},
	{
		position: 'forward',
		slotIndex: 4,
		key: 'LW',
		labelKey: 'rink.leftWing',
		x: 30,
		y: 48,
		line: 2,
		pair: 0
	},
	{
		position: 'forward',
		slotIndex: 5,
		key: 'RW',
		labelKey: 'rink.rightWing',
		x: 70,
		y: 48,
		line: 2,
		pair: 0
	},
	{
		position: 'forward',
		slotIndex: 6,
		key: 'LW',
		labelKey: 'rink.leftWing',
		x: 30,
		y: 34,
		line: 3,
		pair: 0
	},
	{
		position: 'forward',
		slotIndex: 7,
		key: 'RW',
		labelKey: 'rink.rightWing',
		x: 70,
		y: 34,
		line: 3,
		pair: 0
	},
	{
		position: 'defense',
		slotIndex: 0,
		key: 'LD',
		labelKey: 'rink.leftDefense',
		x: 30,
		y: 62,
		line: 0,
		pair: 1
	},
	{
		position: 'defense',
		slotIndex: 1,
		key: 'RD',
		labelKey: 'rink.rightDefense',
		x: 70,
		y: 62,
		line: 0,
		pair: 1
	},
	{
		position: 'defense',
		slotIndex: 2,
		key: 'LD',
		labelKey: 'rink.leftDefense',
		x: 30,
		y: 76,
		line: 0,
		pair: 2
	},
	{
		position: 'defense',
		slotIndex: 3,
		key: 'RD',
		labelKey: 'rink.rightDefense',
		x: 70,
		y: 76,
		line: 0,
		pair: 2
	},
	{
		position: 'defense',
		slotIndex: 4,
		key: 'LD',
		labelKey: 'rink.leftDefense',
		x: 12,
		y: 68,
		line: 0,
		pair: 3
	},
	{
		position: 'defense',
		slotIndex: 5,
		key: 'RD',
		labelKey: 'rink.rightDefense',
		x: 88,
		y: 68,
		line: 0,
		pair: 3
	},
	{
		position: 'defense',
		slotIndex: 6,
		key: 'LD',
		labelKey: 'rink.leftDefense',
		x: 12,
		y: 80,
		line: 0,
		pair: 4
	},
	{
		position: 'defense',
		slotIndex: 7,
		key: 'RD',
		labelKey: 'rink.rightDefense',
		x: 88,
		y: 80,
		line: 0,
		pair: 4
	},
	{
		position: 'goalie',
		slotIndex: 0,
		key: 'G',
		labelKey: 'rink.goalie',
		x: 50,
		y: 92,
		line: 0,
		pair: 0
	},
] as const satisfies readonly RinkPlacement[];

/**
 * Associe une place d'alignement à sa position sur la patinoire. Les places
 * sans rôle de glace (deuxième et troisième gardien) retournent null : elles
 * vivent dans les places hors glace, pas sur le dessin.
 */
export function rinkRole(
	position: Position,
	slotIndex: number
): RinkPlacement | null {
	if (!Number.isInteger(slotIndex) || slotIndex < 0) return null;
	return (
		RINK_PLACEMENTS.find(
			(placement) =>
				placement.position === position && placement.slotIndex === slotIndex
		) ?? null
	);
}

type RinkMeasures = {
	length: number;
	goalLine: number;
	blueLine: number;
	circleRadius: number;
};

export type RinkLineVariables = {
	center: string;
	blueLeft: string;
	blueRight: string;
	goalLeft: string;
	goalRight: string;
	circle: string;
};

function lengthPercent(meters: number, length: number): string {
	return `${Number(((meters / length) * 100).toFixed(3))}%`;
}

/**
 * Les lignes peintes viennent des mesures, jamais d'un pourcentage recopié :
 * changer `RINK` change la glace rendue.
 */
export function rinkLineVariables(rink: RinkMeasures = RINK): RinkLineVariables {
	return {
		center: lengthPercent(rink.length / 2, rink.length),
		blueLeft: lengthPercent(rink.blueLine, rink.length),
		blueRight: lengthPercent(rink.length - rink.blueLine, rink.length),
		goalLeft: lengthPercent(rink.goalLine, rink.length),
		goalRight: lengthPercent(rink.length - rink.goalLine, rink.length),
		circle: lengthPercent(rink.circleRadius * 2, rink.length)
	};
}

/** Le style inline qui alimente les variables CSS de la glace. */
export function rinkGeometryStyle(rink: RinkMeasures = RINK): string {
	const lines = rinkLineVariables(rink);
	return [
		`--rink-center: ${lines.center}`,
		`--rink-blue-left: ${lines.blueLeft}`,
		`--rink-blue-right: ${lines.blueRight}`,
		`--rink-goal-left: ${lines.goalLeft}`,
		`--rink-goal-right: ${lines.goalRight}`,
		`--rink-circle: ${lines.circle}`
	].join('; ');
}
