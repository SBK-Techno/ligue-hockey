import type { Position } from '#config/positions.ts';
import { buildSlotDefinitions, rosterTemplateFromSettings } from '#config/roster.ts';
import { requirePermission, requireUser, can } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { generateTeams } from '#lib/domain/teams/generator.ts';
import { rulesForGeneration } from '#lib/domain/rules/generation.ts';
import { getLocation, getLocationDetails } from '#lib/domain/locations/service.ts';
import { generationCandidates, playersByIds } from '#lib/domain/players/candidates.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { cancelAllForGame } from '#lib/domain/subs/generation.ts';
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
	findGame,
	insertGameWithSlots,
	listAvailability,
	listGames,
	listSlotAssignments,
	saveAssignments,
	updateGame as updateGameRow,
	upsertAvailability,
	type SlotAssignment
} from './queries.ts';
import { buildLineupPool, templateFromRow } from './pool.ts';
import type { GameRow } from './schema.ts';
import type { GameBenchView, GameGenerationView, GameSlotView, GameSummary } from './types.ts';
import {
	gameInputSchema,
	generationSnapshotSchema,
	type GameInput,
	type GenerationSnapshot
} from './validators.ts';

export type GameView = GameSummary & {
	notes: string | null;
	locationAddress: string | null;
	locationMapUrl: string | null;
	slots: GameSlotView[];
	generation: GameGenerationView | null;
	openSlots: number;
	openSlotsLabel: string;
	generated: boolean;
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

function generationView(
	row: GameRow,
	names: Map<string, { fullName: string; position: Position; jerseyNumber: number | null }>,
	includeMetrics: boolean
): GameGenerationView | null {
	const snapshot = snapshotFrom(row);
	if (!snapshot) return null;
	return {
		skillDiff: includeMetrics ? snapshot.skillDiff : null,
		ageDiff: includeMetrics ? snapshot.ageDiff : null,
		sizeDiff: includeMetrics ? snapshot.sizeDiff : null,
		skillDiffLabel: includeMetrics ? formatDecimal(snapshot.skillDiff, 2) : null,
		ageDiffLabel: includeMetrics ? formatDecimal(snapshot.ageDiff, 1) : null,
		warnings: snapshot.warnings,
		ruleViolations: includeMetrics
			? snapshot.ruleViolations.map((violation) => ({
			ruleId: violation.ruleId,
			kind: violation.kind,
			strict: violation.strict,
			playerIds: violation.playerIds,
					names: [
						names.get(violation.playerIds[0])?.fullName ?? violation.playerIds[0],
						names.get(violation.playerIds[1])?.fullName ?? violation.playerIds[1]
					]
				}))
			: [],
		bench: snapshot.bench.map((entry) => ({
			playerId: entry.playerId,
			fullName: names.get(entry.playerId)?.fullName ?? entry.playerId,
			position: entry.position,
			jerseyNumber: names.get(entry.playerId)?.jerseyNumber ?? null,
			kind: entry.kind
		})),
		generatedAt: snapshot.generatedAt
	};
}

export function listSchedule(actor: Actor): GameSummary[] {
	requireUser(actor);
	return listGames().map(summary);
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
	const players = playersByIds([...new Set(playerIds)]);
	const names = new Map(
		players.map((player) => [
			player.userId,
			{
				fullName: player.fullName,
				position: player.position,
				jerseyNumber: player.jerseyNumber
			}
		])
	);

	const slots: GameSlotView[] = assignments.map((assignment) => ({
		team: assignment.team,
		position: assignment.position,
		slotIndex: assignment.slotIndex,
		player:
			assignment.playerId && assignment.assignmentKind
				? {
						playerId: assignment.playerId,
						fullName: names.get(assignment.playerId)?.fullName ?? assignment.playerId,
						position: assignment.position,
						jerseyNumber: names.get(assignment.playerId)?.jerseyNumber ?? null,
						kind: assignment.assignmentKind
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
		generation: generationView(row, names, can(actor, 'manageGames')),
		openSlots,
		openSlotsLabel: formatCount(openSlots, 'games.openSlots.one', 'games.openSlots.many'),
		generated: snapshot !== null
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
		id: `${gameId}:${slot.team}:${slot.position}:${slot.index}`,
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

export function updateGame(actor: Actor, gameId: string, input: GameInput): GameSummary {
	requirePermission(actor, 'manageGames');
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	if (row.status !== 'scheduled') {
		throw new AppError('CONFLICT', { key: 'admin.gameNotScheduled' });
	}
	const parsed = parseSchema(gameInputSchema, input);
	const location = getLocation(actor, parsed.locationId);

	try {
		updateGameRow(
			gameId,
			{
				gameDate: parsed.gameDate,
				startTime: parsed.startTime,
				locationId: location.id,
				location: location.name,
				notes: parsed.notes
			},
			clock.nowMs()
		);
	} catch (cause) {
		if ((cause as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
			throw new AppError('CONFLICT', { key: 'admin.gameExists', cause });
		}
		throw cause;
	}

	recordAudit(actor, {
		action: 'game.update',
		entityType: 'game',
		entityId: gameId
	});

	return summary({
		...row,
		gameDate: parsed.gameDate,
		startTime: parsed.startTime,
		locationId: location.id,
		location: location.name,
		notes: parsed.notes
	});
}

export function cancelGame(actor: Actor, gameId: string): void {
	requirePermission(actor, 'manageGames');
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	if (row.status === 'cancelled') return;

	const updatedAt = clock.nowMs();
	cancelGameRow(gameId, updatedAt);
	cancelAllForGame(actor, summary(row));

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

	recordAudit(actor, {
		action: 'game.cancel',
		entityType: 'game',
		entityId: gameId
	});
}

export function regenerateGame(gameId: string): GenerationResult {
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	if (row.status !== 'scheduled') {
		throw new AppError('CONFLICT', { key: 'admin.gameNotScheduled' });
	}

	const template = templateFromRow(row);
	const lineup = buildLineupPool(gameId, template);
	const { settings, bench, players, kindOf } = lineup;

	const result = generateTeams({
		players,
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
		kind: kindOf.get(assignment.playerId) ?? 'regular'
	}));

	const generatedAt = clock.nowMs();
	const snapshot: GenerationSnapshot = {
		skillDiff: result.skillDiff,
		ageDiff: result.ageDiff,
		sizeDiff: result.sizeDiff,
		warnings: result.warnings,
		ruleViolations: result.violations,
		bench,
		candidateKey: result.candidateKey,
		generatedAt
	};

	saveAssignments(gameId, assignments, generatedAt, JSON.stringify(snapshot), generatedAt);

	const namedIds = [
		...bench.map((entry) => entry.playerId),
		...result.violations.flatMap((violation) => violation.playerIds)
	];
	const names = new Map(
		playersByIds([...new Set(namedIds)]).map((player) => [
			player.userId,
			{
				fullName: player.fullName,
				position: player.position,
				jerseyNumber: player.jerseyNumber
			}
		])
	);
	const benchViews: GameBenchView[] = bench.map((entry) => ({
		playerId: entry.playerId,
		fullName: names.get(entry.playerId)?.fullName ?? entry.playerId,
		position: entry.position,
		jerseyNumber: names.get(entry.playerId)?.jerseyNumber ?? null,
		kind: entry.kind
	}));

	return {
		gameId,
		skillDiff: result.skillDiff,
		ageDiff: result.ageDiff,
		sizeDiff: result.sizeDiff,
		skillDiffLabel: formatDecimal(result.skillDiff, 2),
		ageDiffLabel: formatDecimal(result.ageDiff, 1),
		warnings: result.warnings,
		ruleViolations: result.violations.map((violation) => ({
			ruleId: violation.ruleId,
			kind: violation.kind,
			strict: violation.strict,
			playerIds: violation.playerIds,
			names: [
				names.get(violation.playerIds[0])?.fullName ?? violation.playerIds[0],
				names.get(violation.playerIds[1])?.fullName ?? violation.playerIds[1]
			]
		})),
		bench: benchViews,
		generatedAt,
		assignments: assignments.length
	};
}

export function regenerateAsAdmin(actor: Actor, gameId: string): GenerationResult {
	requirePermission(actor, 'manageGames');
	const result = regenerateGame(gameId);
	recordAudit(actor, {
		action: 'game.generate',
		entityType: 'game',
		entityId: gameId,
		metadata: {
			skillDiff: result.skillDiff,
			ageDiff: result.ageDiff,
			assignments: result.assignments
		}
	});
	return result;
}

export function listGamePresence(gameId: string) {
	return listAvailability(gameId);
}

export function setGamePresence(
	gameId: string,
	playerId: string,
	status: 'present' | 'absent',
	at: number
): void {
	upsertAvailability(gameId, playerId, status, at);
}

export function regenerateIfGenerated(gameId: string): {
	regenerated: boolean;
	warning?: I18nKey;
} {
	const row = findGame(gameId);
	if (!row?.generatedAt) return { regenerated: false };

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
