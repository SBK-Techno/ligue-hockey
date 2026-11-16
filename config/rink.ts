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

/**
 * Les six places de départ. Les deuxièmes trios réutilisent les mêmes
 * coordonnées : la place est un trio, la position sur la glace est la même.
 */
export const RINK_ROLES = [
	{ key: 'G', labelKey: 'rink.goalie', x: 50, y: 92, line: 0, pair: 0 },
	{ key: 'LD', labelKey: 'rink.leftDefense', x: 30, y: 62, line: 0, pair: 1 },
	{ key: 'RD', labelKey: 'rink.rightDefense', x: 70, y: 62, line: 0, pair: 1 },
	{ key: 'C', labelKey: 'rink.center', x: 50, y: 50, line: 1, pair: 0 },
	{ key: 'LW', labelKey: 'rink.leftWing', x: 16, y: 38, line: 1, pair: 0 },
	{ key: 'RW', labelKey: 'rink.rightWing', x: 84, y: 38, line: 1, pair: 0 }
] as const satisfies readonly RinkRoleDefinition[];

export type RinkPlacement = RinkRoleDefinition;

function role(key: RinkRoleKey): RinkRoleDefinition {
	const definition = RINK_ROLES.find((entry) => entry.key === key);
	if (!definition) {
		throw new Error(`Unknown rink role: ${key}`);
	}
	return definition;
}

const FORWARD_ROLES: readonly RinkRoleKey[] = ['C', 'LW', 'RW', 'C', 'LW', 'RW'];
const DEFENSE_ROLES: readonly RinkRoleKey[] = ['LD', 'RD', 'LD', 'RD'];

/**
 * Associe une place d'alignement à sa position sur la patinoire. Les surnuméraires
 * retournent null : ils vivent dans la liste des joueurs sans place, pas sur la
 * glace. Les six rôles restent une pure présentation; le schéma garde les trois
 * positions grossières.
 */
export function rinkRole(
	position: Position,
	slotIndex: number
): RinkPlacement | null {
	if (!Number.isInteger(slotIndex) || slotIndex < 0) return null;

	if (position === 'goalie') {
		return slotIndex === 0 ? role('G') : null;
	}

	if (position === 'defense') {
		const key = DEFENSE_ROLES[slotIndex];
		if (!key) return null;
		return { ...role(key), pair: slotIndex < 2 ? 1 : 2 };
	}

	const key = FORWARD_ROLES[slotIndex];
	if (!key) return null;
	return { ...role(key), line: slotIndex < 3 ? 1 : 2 };
}
