import type { GameSlotView } from '#lib/domain/games/types.ts';

/**
 * La logique de la glace est pure : elle décide où va chaque joueur sans
 * toucher au DOM ni au serveur. Le composant ne fait que rendre la carte.
 */
export type LineupAssignmentMap = Record<string, string | null>;

export type LineupPlacement = {
	key: string;
	team: GameSlotView['team'];
	position: GameSlotView['position'];
	slotIndex: number;
	playerId: string | null;
};

export function slotKey(slot: {
	team: GameSlotView['team'];
	position: GameSlotView['position'];
	slotIndex: number;
}): string {
	return `${slot.team}:${slot.position}:${slot.slotIndex}`;
}

export function initialAssignments(
	slots: readonly GameSlotView[]
): LineupAssignmentMap {
	const map: LineupAssignmentMap = {};
	for (const slot of slots) {
		map[slotKey(slot)] = slot.player?.playerId ?? null;
	}
	return map;
}

export function placementsOf(
	slots: readonly GameSlotView[],
	map: LineupAssignmentMap
): LineupPlacement[] {
	return slots.map((slot) => ({
		key: slotKey(slot),
		team: slot.team,
		position: slot.position,
		slotIndex: slot.slotIndex,
		playerId: map[slotKey(slot)] ?? null
	}));
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

/** Le format attendu par `saveManualLineup`, sans les places vides. */
export function assignmentsForSave(
	slots: readonly GameSlotView[],
	map: LineupAssignmentMap
) {
	return slots
		.filter((slot) => map[slotKey(slot)])
		.map((slot) => ({
			team: slot.team,
			position: slot.position,
			slotIndex: slot.slotIndex,
			playerId: map[slotKey(slot)] as string
		}));
}
