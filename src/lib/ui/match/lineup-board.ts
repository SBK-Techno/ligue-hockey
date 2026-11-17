import { positionDefinition, type Position } from '#config/positions.ts';
import { rinkRole, type RinkPlacement } from '#config/rink.ts';
import { slotKey } from '#config/slot.ts';
import { teamDefinition, type Team } from '#config/teams.ts';
import type { GameSlotView } from '#lib/domain/games/types.ts';
import { t } from '#lib/shared/i18n/index.ts';

type NamedPlacement = {
	position: Position;
	slotIndex: number;
	role: Pick<RinkPlacement, 'labelKey' | 'line' | 'pair'> | null;
};

/** Le nom de famille affiché sous le numéro, sur un jeton de la glace. */
export function rinkPlayerLastName(fullName: string): string {
	return fullName.trim().split(/\s+/).at(-1) ?? fullName;
}

/** Le texte visible d'un jeton rempli : le numéro, puis le nom de famille. */
export function rinkTokenText(player: {
	jerseyNumber: number | null;
	fullName: string;
}): string {
	return `${player.jerseyNumber ?? '?'} ${rinkPlayerLastName(player.fullName)}`;
}

/**
 * Le nom accessible d'une place : équipe, rôle, puis trio ou paire. Les deux
 * centres et les deux ailes ne partagent donc jamais un nom; une place hors
 * glace se distingue par son indice. Aucun écran ne recompose ce nom.
 *
 * Le libellé visible du jeton est construit par la même fonction, puis le nom
 * complet est ajouté : le nom accessible contient toujours le texte visible,
 * comme l'exige le critère « label in name ».
 */
export function slotAriaLabel(
	team: Team,
	placement: NamedPlacement,
	player: { jerseyNumber: number | null; fullName: string } | null
): string {
	const parts = [t(teamDefinition(team).labelKey)];
	if (placement.role) {
		parts.push(t(placement.role.labelKey));
		if (placement.position === 'forward') {
			parts.push(t('rink.line', { line: placement.role.line }));
		} else if (placement.position === 'defense') {
			parts.push(t('rink.pair', { pair: placement.role.pair }));
		}
	} else {
		parts.push(t(positionDefinition(placement.position).labelKey));
		parts.push(t('rink.extraSlot', { index: placement.slotIndex + 1 }));
	}
	parts.push(
		player
			? `${rinkTokenText(player)}, ${player.fullName}`
			: t('rink.emptySlot')
	);
	return parts.join(', ');
}

/**
 * La logique de la glace est pure : elle décide où va chaque joueur sans
 * toucher au DOM ni au serveur. Le composant ne fait que rendre la carte.
 */
export type LineupAssignmentMap = Record<string, string | null>;

/** Le protocole du banc : une seule chaîne, lue et écrite par ce module. */
const BENCH_PREFIX = 'bench:';

export function benchKey(playerId: string): string {
	return `${BENCH_PREFIX}${playerId}`;
}

export function benchPlayerId(key: string): string | null {
	return key.startsWith(BENCH_PREFIX) ? key.slice(BENCH_PREFIX.length) : null;
}

export type LineupPlacement = {
	key: string;
	team: GameSlotView['team'];
	position: GameSlotView['position'];
	slotIndex: number;
	playerId: string | null;
	role: RinkPlacement | null;
};

export function initialAssignments(
	slots: readonly GameSlotView[]
): LineupAssignmentMap {
	const map: LineupAssignmentMap = {};
	for (const slot of slots) {
		map[slotKey(slot)] = slot.player?.playerId ?? null;
	}
	return map;
}

function placementsOf(
	slots: readonly GameSlotView[],
	map: LineupAssignmentMap
): LineupPlacement[] {
	return slots.map((slot) => ({
		key: slotKey(slot),
		team: slot.team,
		position: slot.position,
		slotIndex: slot.slotIndex,
		playerId: map[slotKey(slot)] ?? null,
		role: rinkRole(slot.position, slot.slotIndex)
	}));
}

/** Les places de la carte, avec leur rôle de glace ou hors glace. */
export function boardPlacements(
	slots: readonly GameSlotView[]
): LineupPlacement[] {
	return placementsOf(slots, initialAssignments(slots));
}

/** Échange deux places, même quand l'une des deux est vide. */
export function swapPlayers(
	map: LineupAssignmentMap,
	from: string,
	to: string
): LineupAssignmentMap {
	if (!(from in map) || !(to in map)) return map;
	return { ...map, [from]: map[to], [to]: map[from] };
}

/**
 * Pose un joueur du banc sur une place. S'il était déjà sur la glace, il
 * échange avec le joueur de la place visée; sinon, le joueur visé retourne au
 * banc et disparaît de la carte.
 */
export function placeFromBench(
	map: LineupAssignmentMap,
	playerId: string,
	target: string
): LineupAssignmentMap {
	if (!(target in map)) return map;
	const current = Object.values(map);
	if (!current.includes(playerId)) {
		return { ...map, [target]: playerId };
	}
	const previous = Object.keys(map).find((key) => map[key] === playerId);
	if (!previous || previous === target) return map;
	return swapPlayers(map, previous, target);
}

export function removePlayer(
	map: LineupAssignmentMap,
	key: string
): LineupAssignmentMap {
	if (!(key in map)) return map;
	return { ...map, [key]: null };
}

export type LineupSelection = {
	selected: string | null;
	assignments: LineupAssignmentMap;
};

/**
 * La sélection d'une place : un premier clic choisit un joueur, un second
 * clic sur la même place le relâche, une place vide ne se sélectionne pas.
 * Ces transitions sont pures pour être testées sans navigateur.
 */
export function selectPlace(
	state: LineupSelection,
	key: string
): LineupSelection {
	if (state.selected === key) {
		return { selected: null, assignments: state.assignments };
	}
	if (state.selected === null) {
		return {
			selected: state.assignments[key] ? key : null,
			assignments: state.assignments
		};
	}
	const playerId = benchPlayerId(state.selected);
	if (playerId !== null) {
		return {
			selected: null,
			assignments: placeFromBench(state.assignments, playerId, key)
		};
	}
	return {
		selected: null,
		assignments: swapPlayers(state.assignments, state.selected, key)
	};
}

export function selectBenchPlayer(
	state: LineupSelection,
	playerId: string
): LineupSelection {
	return {
		selected: state.selected === benchKey(playerId) ? null : benchKey(playerId),
		assignments: state.assignments
	};
}

export function clearSelectedPlace(state: LineupSelection): LineupSelection {
	if (state.selected === null || benchPlayerId(state.selected) !== null) {
		return state;
	}
	return {
		selected: null,
		assignments: removePlayer(state.assignments, state.selected)
	};
}

/**
 * Le format attendu par `saveManualLineup` : une formation complète, chaque
 * place du modèle étant envoyée avec `null` quand elle est vide.
 */
export function assignmentsForSave(
	slots: readonly GameSlotView[],
	map: LineupAssignmentMap
) {
	return slots.map((slot) => ({
		team: slot.team,
		position: slot.position,
		slotIndex: slot.slotIndex,
		playerId: map[slotKey(slot)] ?? null
	}));
}
