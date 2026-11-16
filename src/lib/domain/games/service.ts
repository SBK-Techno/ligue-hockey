import type { Position } from '#config/positions.ts';
import {
	buildSlotDefinitions,
	rosterTemplateFromSettings,
	rosterTemplateSchema,
	type RosterTemplate
} from '#config/roster.ts';
import { requirePermission, requireUser, can } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { generateTeams, type GeneratorPlayer } from '#lib/domain/teams/generator.ts';
import { requireCompleteRatings } from '#lib/domain/ratings/service.ts';
import { rulesForGeneration } from '#lib/domain/rules/service.ts';
import { generationCandidates, playersByIds } from '#lib/domain/players/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import {
	cancelAllForGame,
	claimsForGeneration
} from '#lib/domain/subs/service.ts';
import { notify } from '#lib/domain/notifications/service.ts';
import { AppError, isAppError } from '#lib/shared/errors.ts';
import type { I18nKey } from '#config/i18n/fr.ts';
import { formatCount, formatDecimal } from '#lib/shared/i18n/index.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { logger } from '#lib/shared/logging/logger.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import { selectPool as choosePool } from './selection.ts';
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
import type { GameRow } from './schema.ts';
import type {
	GameBenchView,
	GameGenerationView,
	GameSlotView,
	GameSummary
} from './types.ts';
import {
	gameInputSchema,
	generationSnapshotSchema,
	type GameInput,
	type GenerationSnapshot
} from './validators.ts';

export type GameView = GameSummary & {
	notes: string | null;
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
		location: row.location,
		status: row.status
	};
}

function templateFrom(row: GameRow): RosterTemplate {
	try {
		return rosterTemplateSchema.parse(JSON.parse(row.rosterTemplateJson));
	} catch (cause) {
		throw new AppError('INTERNAL', {
			message: 'Invalid roster template snapshot',
			cause
		});
	}
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
	names: Map<string, { fullName: string; position: Position }>,
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
		bench: snapshot.bench.map((entry) => ({
			playerId: entry.playerId,
			fullName: names.get(entry.playerId)?.fullName ?? entry.playerId,
			position: entry.position,
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
		...(snapshot?.bench.map((entry) => entry.playerId) ?? [])
	];
	const players = playersByIds([...new Set(playerIds)]);
	const names = new Map(
		players.map((player) => [
			player.userId,
			{ fullName: player.fullName, position: player.position }
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
						kind: assignment.assignmentKind
					}
				: null
	}));

	const openSlots = slots.filter((slot) => !slot.player).length;

	return {
		...summary(row),
		notes: row.notes,
		slots,
		generation: generationView(row, names, can(actor, 'manageGames')),
		openSlots,
		openSlotsLabel: formatCount(
			openSlots,
			'games.openSlots.one',
			'games.openSlots.many'
		),
		generated: snapshot !== null
	};
}

export function createGame(actor: Actor, input: GameInput): GameSummary {
	requirePermission(actor, 'manageGames');
	const parsed = parseSchema(gameInputSchema, input);
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
				location: parsed.location,
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
		location: parsed.location,
		status: 'scheduled'
	};
}

export function updateGame(
	actor: Actor,
	gameId: string,
	input: GameInput
): GameSummary {
	requirePermission(actor, 'manageGames');
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	if (row.status !== 'scheduled') {
		throw new AppError('CONFLICT', { key: 'admin.gameNotScheduled' });
	}
	const parsed = parseSchema(gameInputSchema, input);

	try {
		updateGameRow(
			gameId,
			{
				gameDate: parsed.gameDate,
				startTime: parsed.startTime,
				location: parsed.location,
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

	return summary({ ...row, ...parsed, notes: parsed.notes });
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

	const settings = getSettings();
	const template = templateFrom(row);
	const { selected, bench } = choosePool({
		template,
		players: generationCandidates().map((player) => ({
			playerId: player.userId,
			position: player.position,
			age: player.age,
			isSubstitute: player.isSubstitute,
			active: player.active
		})),
		availability: listAvailability(gameId),
		claims: claimsForGeneration(gameId)
	});
	const overalls = requireCompleteRatings(selected.map((player) => player.playerId));

	const pool: GeneratorPlayer[] = selected.map((player) => ({
		id: player.playerId,
		position: player.position,
		age: player.age,
		overall: overalls.get(player.playerId) ?? 0,
		kind: player.kind
	}));
	const kindOf = new Map(selected.map((player) => [player.playerId, player.kind]));

	const result = generateTeams({
		players: pool,
		template,
		rules: rulesForGeneration(),
		skillTolerance: settings['teams.skillTolerance'],
		maxPlayers: settings['teams.maxPlayers']
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
		bench,
		candidateKey: result.candidateKey,
		generatedAt
	};

	saveAssignments(
		gameId,
		assignments,
		generatedAt,
		JSON.stringify(snapshot),
		generatedAt
	);

	const names = new Map(
		playersByIds(bench.map((entry) => entry.playerId)).map((player) => [
			player.userId,
			{ fullName: player.fullName, position: player.position }
		])
	);
	const benchViews: GameBenchView[] = bench.map((entry) => ({
		playerId: entry.playerId,
		fullName: names.get(entry.playerId)?.fullName ?? entry.playerId,
		position: entry.position,
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
	if (!getSettings()['teams.autoRegenerate']) return { regenerated: false };

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
