import {
	canFillPosition,
	positionDefinition,
	type Position
} from '#config/positions.ts';
import { rinkRole, type RinkPlacement, type RinkRoleKey } from '#config/rink.ts';
import { slotKey } from '#config/slot.ts';
import { teamDefinition, type Team } from '#config/teams.ts';
import type { I18nKey } from '#config/i18n/fr.ts';
import type { GamePlayer, GameSlotView } from '#lib/domain/games/types.ts';
import { t } from '#lib/shared/i18n/index.ts';

type NamedPlacement = {
	position: Position;
	slotIndex: number;
	role: Pick<RinkPlacement, 'key' | 'labelKey' | 'line' | 'pair'> | null;
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
 * L'abréviation visible d'une place vide. Elle reste courte pour tenir dans le
 * jeton de 44 px, et le nom accessible la reprend pour que le libellé visible
 * soit toujours contenu dans le nom accessible.
 */
const ROLE_SHORT_LABEL: Record<RinkRoleKey, I18nKey> = {
	G: 'rink.short.goalie',
	LD: 'rink.short.leftDefense',
	RD: 'rink.short.rightDefense',
	C: 'rink.short.center',
	LW: 'rink.short.leftWing',
	RW: 'rink.short.rightWing'
};

export function rinkRoleShortLabel(role: Pick<RinkPlacement, 'key'>): string {
	return t(ROLE_SHORT_LABEL[role.key]);
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
		parts.push(rinkRoleShortLabel(placement.role));
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

/**
 * Le banc habillé par équipe au départ : chaque joueur du banc publié avec
 * une équipe habille le banc de cette équipe. Les autres attendent hors
 * effectif et n'ont pas d'équipe.
 */
export function initialBenchTeams(bench: readonly GamePlayer[]): Record<string, Team> {
	const teams: Record<string, Team> = {};
	for (const entry of bench) {
		if (entry.team) teams[entry.playerId] = entry.team;
	}
	return teams;
}

/**
 * The position of every slot and every player, read once. Every board gesture
 * goes through this table: a player can only occupy a slot of their position,
 * and the server applies the same rule when saving.
 */
export type PlacementRules = {
	slotPosition(key: string): Position | null;
	slotTeam(key: string): Team | null;
	playerPosition(playerId: string): Position | null;
};

export function placementRules(
	slots: readonly GameSlotView[],
	players: readonly Pick<GamePlayer, 'playerId' | 'position'>[]
): PlacementRules {
	const slotPositions = new Map(
		slots.map((slot) => [slotKey(slot), slot.position])
	);
	const slotTeams = new Map(slots.map((slot) => [slotKey(slot), slot.team]));
	const playerPositions = new Map(
		players.map((player) => [player.playerId, player.position])
	);
	return {
		slotPosition: (key) => slotPositions.get(key) ?? null,
		slotTeam: (key) => slotTeams.get(key) ?? null,
		playerPosition: (playerId) => playerPositions.get(playerId) ?? null
	};
}

/** The player behind a selection, whether it comes from the ice or the bench. */
function selectedPlayerId(state: LineupSelection): string | null {
	if (state.selected === null) return null;
	const benchId = benchPlayerId(state.selected);
	if (benchId !== null) return benchId;
	return state.assignments[state.selected] ?? null;
}

export function canPlacePlayer(
	rules: PlacementRules,
	playerId: string,
	target: string
): boolean {
	const slot = rules.slotPosition(target);
	const player = rules.playerPosition(playerId);
	return slot !== null && player !== null && canFillPosition([player], slot);
}

/** Checks every slot before publishing a state on the board. */
export function assignmentsAllowed(
	rules: PlacementRules,
	map: LineupAssignmentMap
): boolean {
	return Object.entries(map).every(
		([key, playerId]) =>
			playerId === null || canPlacePlayer(rules, playerId, key)
	);
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

/**
 * La place du joueur connecté dans la formation publiée. Une seule fonction
 * décide s'il est sur la glace, sur le banc ou absent, pour que le résumé, le
 * marqueur « Toi » et le commutateur d'équipe ne divergent jamais.
 */
export type ViewerSpot =
	| {
			kind: 'slot';
			team: Team;
			position: Position;
			slotIndex: number;
			role: RinkRoleKey | null;
			line: number | null;
			pair: number | null;
	  }
	| { kind: 'bench'; team: Team | null }
	| { kind: 'absent' };

export function viewerSpot(
	slots: readonly GameSlotView[],
	bench: readonly GamePlayer[],
	actorId: string | null
): ViewerSpot | null {
	if (!actorId) return null;
	const slot = slots.find((entry) => entry.player?.playerId === actorId);
	if (slot) {
		const role = rinkRole(slot.position, slot.slotIndex);
		return {
			kind: 'slot',
			team: slot.team,
			position: slot.position,
			slotIndex: slot.slotIndex,
			role: role?.key ?? null,
			line: role && slot.position === 'forward' ? role.line : null,
			pair: role && slot.position === 'defense' ? role.pair : null
		};
	}
	const benchEntry = bench.find((player) => player.playerId === actorId);
	if (benchEntry) return { kind: 'bench', team: benchEntry.team ?? null };
	return { kind: 'absent' };
}

/** Échange deux places, même quand l'une des deux est vide. */
export function swapPlayers(
	map: LineupAssignmentMap,
	from: string,
	to: string,
	rules: PlacementRules
): LineupAssignmentMap {
	if (!(from in map) || !(to in map)) return map;
	const fromPlayer = map[from];
	const toPlayer = map[to];
	if (fromPlayer !== null && !canPlacePlayer(rules, fromPlayer, to)) return map;
	if (toPlayer !== null && !canPlacePlayer(rules, toPlayer, from)) return map;
	return { ...map, [from]: toPlayer, [to]: fromPlayer };
}

/**
 * Pose un joueur du banc sur une place. S'il était déjà sur la glace, il
 * échange avec le joueur de la place visée; sinon, le joueur visé retourne au
 * banc et disparaît de la carte.
 */
export function placeFromBench(
	map: LineupAssignmentMap,
	playerId: string,
	target: string,
	rules: PlacementRules
): LineupAssignmentMap {
	if (!(target in map)) return map;
	if (!canPlacePlayer(rules, playerId, target)) return map;
	const current = Object.values(map);
	if (!current.includes(playerId)) {
		return { ...map, [target]: playerId };
	}
	const previous = Object.keys(map).find((key) => map[key] === playerId);
	if (!previous || previous === target) return map;
	return swapPlayers(map, previous, target, rules);
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
	/** Le banc habillé par équipe : playerId -> équipe. Absent : hors effectif. */
	benchTeams: Record<string, Team>;
};

/**
 * Un joueur du banc habillé ne peut prendre une place que de son équipe;
 * un joueur hors effectif (sans équipe) peut rejoindre l'une ou l'autre.
 */
function benchTeamAllows(
	state: LineupSelection,
	playerId: string,
	target: string,
	rules: PlacementRules
): boolean {
	const team = state.benchTeams[playerId];
	return team === undefined || rules.slotTeam(target) === team;
}

/**
 * La sélection d'une place : un premier clic choisit un joueur, un second
 * clic sur la même place le relâche, une place vide ne se sélectionne pas.
 * Ces transitions sont pures pour être testées sans navigateur.
 */
export function selectPlace(
	state: LineupSelection,
	key: string,
	rules: PlacementRules
): LineupSelection {
	if (state.selected === key) {
		return { ...state, selected: null };
	}
	if (state.selected === null) {
		return {
			...state,
			selected: state.assignments[key] ? key : null
		};
	}
	const playerId = selectedPlayerId(state);
	const benchId = benchPlayerId(state.selected);
	const blockedByPosition =
		playerId !== null && !canPlacePlayer(rules, playerId, key);
	const blockedByTeam =
		playerId !== null && benchId !== null && !benchTeamAllows(state, playerId, key, rules);
	if (blockedByPosition || blockedByTeam) {
		/* An occupied slot of another position or team selects its player; an
		   empty slot that cannot accept the selection stays closed. */
		return state.assignments[key] ? { ...state, selected: key } : state;
	}
	return dropOnPlace(state, key, rules);
}

/**
 * Le dépôt d'un joueur sélectionné sur une place, pour le glisser-déposer.
 * Contrairement au second clic, déposer un joueur sur sa propre place ne le
 * relâche pas : c'est un geste sans effet, pas une annulation.
 */
export function dropOnPlace(
	state: LineupSelection,
	target: string,
	rules: PlacementRules
): LineupSelection {
	if (!(target in state.assignments) || state.selected === null) return state;
	if (state.selected === target) return state;
	const playerId = selectedPlayerId(state);
	if (playerId === null || !canPlacePlayer(rules, playerId, target)) return state;
	const benchId = benchPlayerId(state.selected);
	if (benchId !== null) {
		if (!benchTeamAllows(state, benchId, target, rules)) return state;
		const next = placeFromBench(state.assignments, benchId, target, rules);
		if (next === state.assignments) return state;
		// Le joueur quitte le banc pour la glace; le joueur délogé rejoint le
		// banc de l'équipe de la place visée.
		const benchTeams = { ...state.benchTeams };
		delete benchTeams[benchId];
		const displaced = state.assignments[target];
		const targetTeam = rules.slotTeam(target);
		if (displaced && targetTeam && !Object.values(next).includes(displaced)) {
			benchTeams[displaced] = targetTeam;
		}
		return { selected: null, assignments: next, benchTeams };
	}
	if (!(state.selected in state.assignments)) return state;
	return {
		...state,
		selected: null,
		assignments: swapPlayers(state.assignments, state.selected, target, rules)
	};
}

export function selectBenchPlayer(
	state: LineupSelection,
	playerId: string
): LineupSelection {
	return {
		...state,
		selected: state.selected === benchKey(playerId) ? null : benchKey(playerId)
	};
}

export function clearSelectedPlace(
	state: LineupSelection,
	rules: PlacementRules
): LineupSelection {
	if (state.selected === null || benchPlayerId(state.selected) !== null) {
		return state;
	}
	const playerId = state.assignments[state.selected];
	const team = rules.slotTeam(state.selected);
	const benchTeams = { ...state.benchTeams };
	if (playerId && team) benchTeams[playerId] = team;
	return {
		...state,
		selected: null,
		assignments: removePlayer(state.assignments, state.selected),
		benchTeams
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

/**
 * Le banc habillé envoyé à l'enregistrement : les joueurs encore au banc qui
 * ont une équipe. Les joueurs hors effectif (sans équipe) ne sont pas envoyés;
 * le service les recalcule à partir du bassin vivant.
 */
export function benchForSave(
	benchPlayers: readonly Pick<GamePlayer, 'playerId'>[],
	benchTeams: Record<string, Team>
): { playerId: string; team: Team }[] {
	return benchPlayers
		.filter((player) => benchTeams[player.playerId] !== undefined)
		.map((player) => ({ playerId: player.playerId, team: benchTeams[player.playerId] }));
}
