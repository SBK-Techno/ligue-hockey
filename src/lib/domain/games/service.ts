import type { Position } from '#config/positions.ts';
import { buildSlotDefinitions, rosterTemplateFromSettings } from '#config/roster.ts';
import { slotRowId } from '#config/slot.ts';
import { requirePermission, requireUser, can } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { anonymousActor } from '#lib/domain/auth/types.ts';
import { auditEntry, recordAudit } from '#lib/domain/audit/service.ts';
import { isGameStarted, isLineupEditable, visibleParticipants } from './playability.ts';
import { generateTeams } from '#lib/domain/teams/generator.ts';
import { rulesForGeneration } from '#lib/domain/rules/generation.ts';
import { getLocation, getLocationDetails } from '#lib/domain/locations/service.ts';
import { gameWarningsInOrder } from '#config/game-warnings.ts';
import { generationCandidates, playersByIds } from '#lib/domain/players/candidates.ts';
import { neutralPlayerName } from '#lib/domain/players/public.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { closeRequestsForGame } from '#lib/domain/subs/generation.ts';
import { notify } from '#lib/domain/notifications/service.ts';
import { AppError, isAppError } from '#lib/shared/errors.ts';
import type { I18nKey } from '#config/i18n/fr.ts';
import { formatCount, formatDecimal } from '#lib/shared/i18n/index.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { logger } from '#lib/shared/logging/logger.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { parseSchema } from '#lib/shared/validation.ts';

import {
	cancelGame as cancelGameRow,
	completeGame as completeGameRow,
	findGame,
	insertGameWithSlots,
	listAvailability,
	listAvailabilityForPlayer,
	listGameListRows,
	listGames,
	releasePlayerSlot,
	listSlotAssignments,
	saveAssignments,
	updateGame as updateGameRow,
	type SlotAssignment
} from './queries.ts';
import { generationPlan, lineupPool, type LineupPool, type PoolSlot } from './pool.ts';
import type { GameRow } from './schema.ts';
import type {
	GameGenerationView,
	GamePlayer,
	GameSlotView,
	GameSummary
} from './types.ts';
import {
	gameInputSchema,
	generationSnapshotSchema,
	updateGameInputSchema,
	type GameInput,
	type GenerationSnapshot,
	type UpdateGameInput
} from './validators.ts';

export type GameView = GameSummary & {
	notes: string | null;
	locationAddress: string | null;
	locationMapUrl: string | null;
	slots: GameSlotView[];
	generation: GameGenerationView | null;
	completedAt: number | null;
	lineupManualAt: number | null;
	openSlots: number;
	openSlotsLabel: string;
	/** Toutes les places du modèle sont remplies : l'alignement est complet. */
	lineupComplete: boolean;
	generated: boolean;
	/** Jeton de concurrence de la fiche : le formulaire le renvoie tel quel. */
	updatedAt: number;
};

export type GenerationResult = GameGenerationView & {
	gameId: string;
	assignments: number;
};

function summary(row: GameRow): GameSummary {
	return {
		id: row.id,
		gameDate: row.gameDate,
		startTime: row.startTime,
		locationId: row.locationId,
		location: row.location,
		status: row.status
	};
}

function snapshotFrom(row: GameRow): GenerationSnapshot | null {
	if (!row.generationJson) return null;
	try {
		return generationSnapshotSchema.parse(JSON.parse(row.generationJson));
	} catch (cause) {
		throw new AppError('INTERNAL', {
			message: 'Invalid generation snapshot',
			cause
		});
	}
}

type NamedPlayer = {
	fullName: string;
	position: Position;
	jerseyNumber: number | null;
	avatarId: string | null;
	active: boolean;
};

/** La seule projection nommée des joueurs d'un match, partagée par les vues. */
function namedPlayers(playerIds: Iterable<string>): Map<string, NamedPlayer> {
	return new Map(
		playersByIds([...new Set(playerIds)]).map((player) => [
			player.userId,
			{
				fullName: player.fullName,
				position: player.position,
				jerseyNumber: player.jerseyNumber,
				avatarId: player.avatarId,
				active: player.active
			}
		])
	);
}

function generationView(
	row: GameRow,
	names: Map<string, NamedPlayer>,
	includeMetrics: boolean,
	live: LineupPool | null
): GameGenerationView | null {
	const snapshot = snapshotFrom(row);
	if (!snapshot) return null;
	const members = new Map(live?.members.map((member) => [member.playerId, member]) ?? []);
	return {
		skillDiff: includeMetrics ? snapshot.skillDiff : null,
		ageDiff: includeMetrics ? snapshot.ageDiff : null,
		sizeDiff: includeMetrics ? snapshot.sizeDiff : null,
		skillDiffLabel:
			includeMetrics && snapshot.skillDiff !== null
				? formatDecimal(snapshot.skillDiff, 2)
				: null,
		ageDiffLabel: includeMetrics ? formatDecimal(snapshot.ageDiff, 1) : null,
		warnings: gameWarningsInOrder(snapshot.warnings),
		ruleViolations: includeMetrics
			? snapshot.ruleViolations.map((violation) => ({
			ruleId: violation.ruleId,
			kind: violation.kind,
			strict: violation.strict,
			playerIds: violation.playerIds,
					names: [
						names.get(violation.playerIds[0])?.fullName ?? neutralPlayerName(),
						names.get(violation.playerIds[1])?.fullName ?? neutralPlayerName()
					]
				}))
			: [],
		// Le banc publié suit le bassin vivant quand l'alignement est encore
		// modifiable; un match commencé ou terminé garde ses participants.
		bench: live
			? live.bench.map((entry) => ({
					playerId: entry.playerId,
					fullName: live.names.get(entry.playerId) ?? neutralPlayerName(),
					position: entry.position,
					jerseyNumber: members.get(entry.playerId)?.jerseyNumber ?? null,
					avatarId: members.get(entry.playerId)?.avatarId ?? null,
					kind: entry.kind
				}))
			: visibleParticipants(
					row,
					snapshot.bench,
					(playerId) => names.get(playerId)?.active !== false
				).map((entry) => ({
					playerId: entry.playerId,
					fullName: names.get(entry.playerId)?.fullName ?? neutralPlayerName(),
					position: entry.position,
					jerseyNumber: names.get(entry.playerId)?.jerseyNumber ?? null,
					avatarId: names.get(entry.playerId)?.avatarId ?? null,
					kind: entry.kind
				})),
		generatedAt: snapshot.generatedAt
	};
}

export function listSchedule(actor: Actor): GameSummary[] {
	requireUser(actor);
	return listGames().map(summary);
}

export type GameListEntry = GameSummary & {
	generated: boolean;
	openSlots: number;
	openSlotsLabel: string;
};

/**
 * Les lignes d'une liste de matchs, sans charger une fiche par match. Le
 * nombre de places vient du même alignement que la fiche; seul le libellé est
 * composé ici, à partir du seul propriétaire du format de compte.
 */
export function listGameListEntries(
	actor: Actor,
	gameIds: readonly string[]
): Map<string, GameListEntry> {
	requireUser(actor);
	return new Map(
		listGameListRows(gameIds).map((row) => [
			row.id,
			{
				id: row.id,
				gameDate: row.gameDate,
				startTime: row.startTime,
				locationId: row.locationId,
				location: row.location,
				status: row.status,
				generated: row.generated,
				openSlots: row.openSlots,
				openSlotsLabel: formatCount(
					row.openSlots,
					'games.openSlots.one',
					'games.openSlots.many'
				)
			}
		])
	);
}

export function getGame(actor: Actor, gameId: string): GameView {
	requireUser(actor);
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}

	const assignments = listSlotAssignments(gameId);
	const snapshot = snapshotFrom(row);
	const playerIds = [
		...assignments
			.map((assignment) => assignment.playerId)
			.filter((playerId): playerId is string => playerId !== null),
		...(snapshot?.bench.map((entry) => entry.playerId) ?? []),
		...(snapshot?.ruleViolations.flatMap((violation) => violation.playerIds) ?? [])
	];
	const names = namedPlayers(playerIds);
	const poolSlots: PoolSlot[] = assignments.map((assignment) => ({
		team: assignment.team,
		position: assignment.position,
		slotIndex: assignment.slotIndex,
		player:
			assignment.playerId && assignment.assignmentKind
				? { playerId: assignment.playerId, kind: assignment.assignmentKind }
				: null
	}));
	// La seule projection des places et des comptes : le bassin vivant décide
	// de ce qui est publié, avant le début du match. Le gestionnaire, la
	// feuille et la page publique lisent donc le même alignement.
	const live = snapshot && isLineupEditable(row) ? lineupPool(row, poolSlots) : null;
	const published = live?.slots ?? poolSlots;

	const slots: GameSlotView[] = published.map((slot) => ({
		team: slot.team,
		position: slot.position,
		slotIndex: slot.slotIndex,
		player: slot.player
			? {
					playerId: slot.player.playerId,
					fullName: names.get(slot.player.playerId)?.fullName ?? neutralPlayerName(),
					position: slot.position,
					jerseyNumber: names.get(slot.player.playerId)?.jerseyNumber ?? null,
					avatarId: names.get(slot.player.playerId)?.avatarId ?? null,
					kind: slot.player.kind
				}
			: null
	}));

	const openSlots = slots.filter((slot) => !slot.player).length;
	const location = getLocationDetails(actor, row.locationId);

	return {
		...summary(row),
		notes: row.notes,
		locationAddress: location.address,
		locationMapUrl: location.mapUrl,
		slots,
		generation: generationView(row, names, can(actor, 'manageGames'), live),
		completedAt: row.completedAt,
		lineupManualAt: row.lineupManualAt,
		openSlots,
		openSlotsLabel: formatCount(openSlots, 'games.openSlots.one', 'games.openSlots.many'),
		lineupComplete: openSlots === 0,
		generated: snapshot !== null,
		updatedAt: row.updatedAt
	};
}

export function createGame(actor: Actor, input: GameInput): GameSummary {
	requirePermission(actor, 'manageGames');
	const parsed = parseSchema(gameInputSchema, input);
	const location = getLocation(actor, parsed.locationId);
	const settings = getSettings();
	const rosterTemplate = rosterTemplateFromSettings(settings);

	const now = clock.nowMs();
	const gameId = newId('game');
	const slots = buildSlotDefinitions(rosterTemplate).map((slot) => ({
		id: slotRowId(gameId, {
			team: slot.team,
			position: slot.position,
			slotIndex: slot.index
		}),
		gameId,
		team: slot.team,
		position: slot.position,
		slotIndex: slot.index,
		createdAt: now,
		updatedAt: now
	}));

	try {
		insertGameWithSlots(
			{
				id: gameId,
				gameDate: parsed.gameDate,
				startTime: parsed.startTime,
				locationId: location.id,
				location: location.name,
				notes: parsed.notes,
				status: 'scheduled',
				rosterTemplateJson: JSON.stringify(rosterTemplate),
				createdBy: actor.kind === 'user' ? actor.userId : null,
				createdAt: now,
				updatedAt: now
			},
			slots
		);
	} catch (cause) {
		if ((cause as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
			throw new AppError('CONFLICT', { key: 'admin.gameExists', cause });
		}
		throw cause;
	}

	recordAudit(actor, {
		action: 'game.create',
		entityType: 'game',
		entityId: gameId,
		metadata: { gameDate: parsed.gameDate, startTime: parsed.startTime }
	});

	return {
		id: gameId,
		gameDate: parsed.gameDate,
		startTime: parsed.startTime,
		locationId: location.id,
		location: location.name,
		status: 'scheduled'
	};
}

export function updateGame(
	actor: Actor,
	gameId: string,
	input: UpdateGameInput
): GameSummary {
	requirePermission(actor, 'manageGames');
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	if (!isLineupEditable(row)) {
		throw new AppError('CONFLICT', { key: 'admin.gameNotScheduled' });
	}
	const parsed = parseSchema(updateGameInputSchema, input);
	const location = getLocation(actor, parsed.locationId);
	const locationChanged = parsed.locationId !== row.locationId;

	try {
		const saved = updateGameRow(
			gameId,
			{
				gameDate: parsed.gameDate,
				startTime: parsed.startTime,
				locationId: location.id,
				// Le libellé est figé pour les matchs déjà créés : seule une
				// changement de lieu le réécrit.
				...(locationChanged ? { location: location.name } : {}),
				notes: parsed.notes
			},
			clock.nowMs(),
			parsed.expectedUpdatedAt,
			auditEntry(actor, {
				action: 'game.update',
				entityType: 'game',
				entityId: gameId
			})
		);
		if (!saved) {
			throw new AppError('CONFLICT', { key: 'games.lineupChanged' });
		}
	} catch (cause) {
		if ((cause as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
			throw new AppError('CONFLICT', { key: 'admin.gameExists', cause });
		}
		throw cause;
	}

	return summary({
		...row,
		gameDate: parsed.gameDate,
		startTime: parsed.startTime,
		locationId: location.id,
		location: locationChanged ? location.name : row.location
	});
}

export function cancelGame(actor: Actor, gameId: string): void {
	requirePermission(actor, 'manageGames');
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	if (row.status === 'cancelled') return;
	if (row.status === 'completed' || row.completedAt !== null) {
		throw new AppError('CONFLICT', { key: 'games.alreadyCompleted' });
	}
	if (!isLineupEditable(row)) {
		throw new AppError('CONFLICT', { key: 'admin.gameNotScheduled' });
	}

	const updatedAt = clock.nowMs();
	const cancelled = cancelGameRow(
		gameId,
		updatedAt,
		auditEntry(actor, {
			action: 'game.cancel',
			entityType: 'game',
			entityId: gameId
		}),
		(tx) => closeRequestsForGame(actor, gameId, updatedAt, tx, 'cancelled')
	);
	if (!cancelled) {
		throw new AppError('CONFLICT', { key: 'admin.gameNotScheduled' });
	}

	const recipients = generationCandidates().map((player) => ({
		userId: player.userId
	}));
	notify(
		'game_cancelled',
		recipients,
		{
			gameId,
			gameDate: row.gameDate,
			startTime: row.startTime,
			location: row.location
		},
		{ dedupeKey: `game_cancelled:${gameId}` }
	);
}

export function regenerateGame(
	gameId: string,
	actor: Actor = anonymousActor
): GenerationResult {
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	if (row.status !== 'scheduled') {
		throw new AppError('CONFLICT', { key: 'admin.gameNotScheduled' });
	}
	if (
		!isLineupEditable({
			status: row.status,
			gameDate: row.gameDate,
			startTime: row.startTime
		})
	) {
		throw new AppError('CONFLICT', { key: 'games.lineupLocked' });
	}

	const slotRows: PoolSlot[] = listSlotAssignments(gameId).map((slot) => ({
		team: slot.team,
		position: slot.position,
		slotIndex: slot.slotIndex,
		player:
			slot.playerId && slot.assignmentKind
				? { playerId: slot.playerId, kind: slot.assignmentKind }
				: null
	}));
	const pool = lineupPool(row, slotRows);
	const plan = generationPlan(pool);
	const { settings, template } = pool;

	const result = generateTeams({
		players: plan.players,
		template,
		rules: rulesForGeneration(),
		skillTolerance: settings['teams.skillTolerance'],
		maxPlayers: settings['teams.maxPlayers'],
		limits: {
			skill: settings['teams.maxSkillSpread'],
			age: settings['teams.maxAgeSpread'],
			size: settings['teams.maxSizeSpread']
		}
	});

	const assignments: SlotAssignment[] = result.assignments.map((assignment) => ({
		team: assignment.team,
		position: assignment.position,
		slotIndex: assignment.slotIndex,
		playerId: assignment.playerId,
		kind: plan.kindOf.get(assignment.playerId) ?? 'regular'
	}));

	const generatedAt = clock.nowMs();
	const snapshot: GenerationSnapshot = {
		skillDiff: result.skillDiff,
		ageDiff: result.ageDiff,
		sizeDiff: result.sizeDiff,
		warnings: gameWarningsInOrder(result.warnings),
		ruleViolations: result.violations,
		bench: plan.bench,
		candidateKey: result.candidateKey,
		generatedAt
	};

	// L'audit du calcul entre dans la même transaction que les places : une
	// écriture échouée ne laisse ni alignement publié ni trace partielle.
	const saved = saveAssignments(
		gameId,
		assignments,
		generatedAt,
		JSON.stringify(snapshot),
		generatedAt,
		{
			expectedGeneratedAt: row.generatedAt ?? null,
			manualAt: null,
			ratingsAudit: (playerIds) =>
				auditEntry(actor, {
					action: 'ratings.game_removed',
					entityType: 'game',
					entityId: gameId,
					metadata: { playerIds }
				}),
			audits: [
				auditEntry(actor, {
					action: 'game.generate',
					entityType: 'game',
					entityId: gameId,
					metadata: {
						skillDiff: result.skillDiff,
						ageDiff: result.ageDiff,
						assignments: assignments.length
					}
				})
			]
		}
	);
	if (!saved) {
		throw new AppError('CONFLICT', { key: 'games.lineupChanged' });
	}

	const namedIds = [
		...plan.bench.map((entry) => entry.playerId),
		...result.violations.flatMap((violation) => violation.playerIds)
	];
	const names = namedPlayers(namedIds);
	const benchViews: GamePlayer[] = plan.bench.map((entry) => ({
		playerId: entry.playerId,
		fullName: names.get(entry.playerId)?.fullName ?? neutralPlayerName(),
		position: entry.position,
		jerseyNumber: names.get(entry.playerId)?.jerseyNumber ?? null,
		avatarId: names.get(entry.playerId)?.avatarId ?? null,
		kind: entry.kind
	}));

	return {
		gameId,
		skillDiff: result.skillDiff,
		ageDiff: result.ageDiff,
		sizeDiff: result.sizeDiff,
		skillDiffLabel: formatDecimal(result.skillDiff, 2),
		ageDiffLabel: formatDecimal(result.ageDiff, 1),
		warnings: gameWarningsInOrder(result.warnings),
		ruleViolations: result.violations.map((violation) => ({
			ruleId: violation.ruleId,
			kind: violation.kind,
			strict: violation.strict,
			playerIds: violation.playerIds,
			names: [
				names.get(violation.playerIds[0])?.fullName ?? neutralPlayerName(),
				names.get(violation.playerIds[1])?.fullName ?? neutralPlayerName()
			]
		})),
		bench: benchViews,
		generatedAt,
		assignments: assignments.length
	};
}

export function regenerateAsAdmin(actor: Actor, gameId: string): GenerationResult {
	requirePermission(actor, 'manageGames');
	return regenerateGame(gameId, actor);
}

export function listGamePresence(gameId: string) {
	return listAvailability(gameId);
}

/** La réponse d'un joueur pour une série de matchs, sans charger les feuilles. */
export function listPlayerAvailability(gameIds: readonly string[], playerId: string) {
	return listAvailabilityForPlayer(gameIds, playerId);
}

/**
 * Termine un match commencé. Le statut et l'estampille sont écrits ensemble :
 * un match terminé se reconnaît à `completed_at`, jamais au statut seul.
 */
export function completeGame(actor: Actor, gameId: string): void {
	requirePermission(actor, 'manageGames');
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	if (row.status === 'cancelled') {
		throw new AppError('CONFLICT', { key: 'games.cannotFinalizeCancelled' });
	}
	if (row.status === 'completed' || row.completedAt !== null) {
		throw new AppError('CONFLICT', { key: 'games.alreadyCompleted' });
	}
	if (!isGameStarted(row)) {
		throw new AppError('CONFLICT', { key: 'games.notStarted' });
	}

	const at = clock.nowMs();
	const finalized = completeGameRow(
		gameId,
		at,
		auditEntry(actor, {
			action: 'game.finalized',
			entityType: 'game',
			entityId: gameId
		}),
		(tx) => closeRequestsForGame(actor, gameId, at, tx, 'finalized')
	);
	if (!finalized) {
		throw new AppError('CONFLICT', { key: 'games.alreadyCompleted' });
	}
}

/**
 * Retire un joueur d'un alignement encore modifiable. Une sortie ne laisse
 * jamais sa place ni son banc derrière elle : la prochaine lecture, y compris
 * la feuille de match, ne le voit plus. Le match commencé ou terminé garde ses
 * participants.
 */
export function releaseFromLineup(
	actor: Actor,
	gameId: string,
	playerId: string,
	reason: 'absence' | 'bumped' | 'released'
): boolean {
	const row = findGame(gameId);
	if (!row || !isLineupEditable(row)) return false;
	return releasePlayerSlot(
		gameId,
		playerId,
		clock.nowMs(),
		auditEntry(actor, {
			action: 'game.lineup_release',
			entityType: 'game',
			entityId: gameId,
			metadata: { playerId, reason }
		})
	);
}

export function regenerateIfGenerated(gameId: string): {
	regenerated: boolean;
	warning?: I18nKey;
} {
	const row = findGame(gameId);
	if (!row?.generatedAt) return { regenerated: false };
	// Un alignement enregistré à la main reste intact tant qu'un gestionnaire
	// ne demande pas explicitement de le refaire.
	if (row.lineupManualAt !== null) return { regenerated: false };

	try {
		regenerateGame(gameId);
		return { regenerated: true };
	} catch (error) {
		logger.error('game.auto_regenerate_failed', { gameId, error });
		return {
			regenerated: false,
			warning: isAppError(error) ? error.key : 'error.generic'
		};
	}
}
