import { TEAMS, otherTeam, type Team } from '#config/teams.ts';
import { requirePermission, requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { auditEntry } from '#lib/domain/audit/service.ts';
import { getGame, completeGame, type GameView } from '#lib/domain/games/service.ts';
import { isGamePlayable } from '#lib/domain/games/playability.ts';
import { deletedPlayerIds, playersByIds } from '#lib/domain/players/candidates.ts';
import { AppError } from '#lib/shared/errors.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import {
	deleteGoal as deleteGoalRow,
	deletePenalty as deletePenaltyRow,
	findGoal,
	findPenalty,
	insertGoal,
	insertPenalty,
	listGoalTotals,
	listGoals,
	listPenalties,
	updateGoal as updateGoalRow,
	updatePenalty as updatePenaltyRow
} from './queries.ts';
import type {
	GameGoalRow,
	GamePenaltyRow,
	NewGameGoalRow,
	NewGamePenaltyRow
} from './schema.ts';
import type {
	GameGoalView,
	GamePenaltyView,
	GamePlayerRef,
	GameSheetView,
	PlayerTotals
} from './types.ts';
import {
	goalInputSchema,
	penaltyInputSchema,
	type PenaltyInput
} from './validators.ts';
import {
	goalRowFrom,
	resolveGoalEntry,
	resolvePenaltyEntry
} from './entry.ts';

function playerRef(
	team: Team,
	playerId: string | null,
	fullName: string,
	jerseyNumber: number | null,
	deleted: ReadonlySet<string>
): GamePlayerRef {
	return {
		playerId: playerId !== null && !deleted.has(playerId) ? playerId : '',
		fullName,
		jerseyNumber,
		team
	};
}

function goalView(
	row: GameGoalRow,
	deleted: ReadonlySet<string> = new Set()
): GameGoalView {
	const assists: GamePlayerRef[] = [];
	if (row.assist1Name !== null) {
		assists.push(
			playerRef(
				row.team,
				row.assist1PlayerId,
				row.assist1Name,
				row.assist1Number,
				deleted
			)
		);
	}
	if (row.assist2Name !== null) {
		assists.push(
			playerRef(
				row.team,
				row.assist2PlayerId,
				row.assist2Name,
				row.assist2Number,
				deleted
			)
		);
	}
	return {
		id: row.id,
		team: row.team,
		period: row.period,
		clock: row.clock,
		kind: row.kind,
		scorer: playerRef(
			row.kind === 'own_goal' ? otherTeam(row.team) : row.team,
			row.scorerPlayerId,
			row.scorerName,
			row.scorerNumber,
			deleted
		),
		assists,
		ownGoal: row.kind === 'own_goal',
		penaltyShot: row.kind === 'penalty_shot'
	};
}

function penaltyView(
	row: GamePenaltyRow,
	deleted: ReadonlySet<string> = new Set()
): GamePenaltyView {
	return {
		id: row.id,
		team: row.team,
		period: row.period,
		clock: row.clock,
		player: playerRef(
			row.team,
			row.playerId,
			row.playerName,
			row.playerNumber,
			deleted
		),
		infraction: row.infraction,
		minutes: row.minutes,
		coincidental: row.coincidental
	};
}

function nameOf(playerIds: ReadonlySet<string>): Map<string, string> {
	return new Map(
		playersByIds([...playerIds]).map((player) => [
			player.userId,
			player.fullName
		])
	);
}

function startedGame(actor: Actor, gameId: string): GameView {
	requirePermission(actor, 'manageGames');
	const game = getGame(actor, gameId);
	if (!isGamePlayable(game)) {
		throw new AppError('CONFLICT', {
			key: game.status === 'cancelled' ? 'gamesheet.cancelled' : 'games.notStarted'
		});
	}
	return game;
}

/**
 * Feuille de match complète : buts, pénalités, score et totaux par joueur
 * habillé. Aucune note et aucun solde n'entrent dans ce modèle.
 */
export type GameScore = Record<Team, number>;

/**
 * Le score de plusieurs matchs sans charger les feuilles complètes : l'accueil
 * affiche le résultat des derniers matchs, pas leurs 30 buts un par un.
 */
export function listGameScores(
	actor: Actor,
	gameIds: readonly string[]
): Map<string, GameScore> {
	requireUser(actor);
	const scores = new Map<string, GameScore>(
		gameIds.map((gameId) => [gameId, { black: 0, white: 0 }])
	);
	for (const row of listGoalTotals(gameIds)) {
		const score = scores.get(row.gameId);
		if (score) score[row.team] = row.goals;
	}
	return scores;
}

export function getGameSheet(actor: Actor, game: GameView): GameSheetView {
	requireUser(actor);
	if (!isGamePlayable(game)) {
		throw new AppError('CONFLICT', {
			key: game.status === 'cancelled' ? 'gamesheet.cancelled' : 'games.notStarted'
		});
	}
	const goals = listGoals(game.id);
	const penalties = listPenalties(game.id);
	const deleted = deletedPlayerIds([
		...game.slots.flatMap((slot) => (slot.player ? [slot.player.playerId] : [])),
		...goals.flatMap((goal) => [
			...(goal.scorerPlayerId ? [goal.scorerPlayerId] : []),
			...(goal.assist1PlayerId ? [goal.assist1PlayerId] : []),
			...(goal.assist2PlayerId ? [goal.assist2PlayerId] : [])
		]),
		...penalties.flatMap((penalty) =>
			penalty.playerId ? [penalty.playerId] : []
		)
	]);

	const score = Object.fromEntries(
		TEAMS.map((team) => [team.key, 0])
	) as Record<Team, number>;
	const totals = new Map<string, PlayerTotals>();

	for (const slot of game.slots) {
		if (!slot.player) continue;
		totals.set(slot.player.playerId, {
			playerId: slot.player.playerId,
			fullName: slot.player.fullName,
			jerseyNumber: slot.player.jerseyNumber,
			team: slot.team,
			goals: 0,
			assists: 0,
			points: 0,
			penaltyMinutes: 0
		});
	}

	for (const goal of goals) {
		// Un but contre son camp est écrit avec l'équipe créditée du but et le
		// dernier attaquant comme buteur : le score compte pour cette équipe.
		score[goal.team] += 1;
		// Un but contre son camp n'est jamais un but au dossier du joueur.
		if (goal.scorerPlayerId && goal.kind !== 'own_goal') {
			const entry = totals.get(goal.scorerPlayerId);
			if (entry) entry.goals += 1;
		}
		for (const assistId of [goal.assist1PlayerId, goal.assist2PlayerId]) {
			if (!assistId) continue;
			const entry = totals.get(assistId);
			if (entry) entry.assists += 1;
		}
	}
	for (const penalty of penalties) {
		if (!penalty.playerId) continue;
		const entry = totals.get(penalty.playerId);
		if (entry) entry.penaltyMinutes += penalty.minutes;
	}

	const teamOrder = new Map(TEAMS.map((team, index) => [team.key, index]));
	const rows = [...totals.values()]
		.map((entry) => ({
			...entry,
			playerId: deleted.has(entry.playerId) ? '' : entry.playerId,
			points: entry.goals + entry.assists
		}))
		.sort(
			(a, b) =>
				(teamOrder.get(a.team) ?? 0) - (teamOrder.get(b.team) ?? 0) ||
				(a.jerseyNumber ?? Number.MAX_SAFE_INTEGER) -
					(b.jerseyNumber ?? Number.MAX_SAFE_INTEGER) ||
				a.fullName.localeCompare(b.fullName) ||
				a.playerId.localeCompare(b.playerId)
		);

	return {
		gameId: game.id,
		goals: goals.map((goal) => goalView(goal, deleted)),
		penalties: penalties.map((penalty) => penaltyView(penalty, deleted)),
		score,
		totals: rows,
		finalized: game.completedAt !== null
	};
}

export function addGoal(actor: Actor, gameId: string, input: unknown): GameGoalView {
	const game = startedGame(actor, gameId);
	const parsed = parseSchema(goalInputSchema, input);
	const now = clock.nowMs();
	const id = newId('goal');
	const row: NewGameGoalRow = goalRowFrom(game, parsed, {
		id,
		gameId,
		createdAt: now,
		createdBy: actor.kind === 'user' ? actor.userId : null,
		names: nameOf(
			new Set(
				[parsed.scorerPlayerId, parsed.assist1PlayerId, parsed.assist2PlayerId].filter(
					(value): value is string => value !== null
				)
			)
		)
	});
	insertGoal(
		row,
		auditEntry(actor, {
			action: 'game.goal_added',
			entityType: 'game',
			entityId: gameId,
			metadata: {
				goalId: id,
				team: parsed.team,
				period: parsed.period,
				clock: parsed.clock,
				corrected: game.status === 'completed'
			}
		})
	);
	const created = findGoal(id);
	if (!created) throw new AppError('INTERNAL');
	return goalView(created);
}

export function updateGoal(
	actor: Actor,
	gameId: string,
	goalId: string,
	input: unknown
): GameGoalView {
	const game = startedGame(actor, gameId);
	const existing = findGoal(goalId);
	if (!existing || existing.gameId !== gameId) {
		throw new AppError('NOT_FOUND', { key: 'gamesheet.goalNotFound' });
	}
	const parsed = parseSchema(goalInputSchema, input);
	const resolved = resolveGoalEntry(
		game,
		parsed,
		nameOf(
			new Set(
				[parsed.scorerPlayerId, parsed.assist1PlayerId, parsed.assist2PlayerId].filter(
					(value): value is string => value !== null
				)
			)
		)
	);
	const now = clock.nowMs();
	const patch: Partial<NewGameGoalRow> = {
		team: parsed.team,
		period: parsed.period,
		clock: parsed.clock,
		kind: parsed.kind,
		scorerPlayerId: parsed.scorerPlayerId,
		scorerName: resolved.scorer.fullName,
		scorerNumber: resolved.scorer.jerseyNumber,
		assist1PlayerId: parsed.assist1PlayerId,
		assist1Name: resolved.assists[0]?.slot.fullName ?? null,
		assist1Number: resolved.assists[0]?.slot.jerseyNumber ?? null,
		assist2PlayerId: parsed.assist2PlayerId,
		assist2Name: resolved.assists[1]?.slot.fullName ?? null,
		assist2Number: resolved.assists[1]?.slot.jerseyNumber ?? null,
		updatedAt: now
	};
	const updated = updateGoalRow(
		goalId,
		gameId,
		patch,
		auditEntry(actor, {
			action: 'game.goal_updated',
			entityType: 'game',
			entityId: gameId,
			metadata: { goalId, corrected: game.status === 'completed' }
		})
	);
	if (!updated) {
		throw new AppError('NOT_FOUND', { key: 'gamesheet.goalNotFound' });
	}
	const saved = findGoal(goalId);
	if (!saved) throw new AppError('INTERNAL');
	return goalView(saved);
}

export function deleteGoal(
	actor: Actor,
	gameId: string,
	goalId: string
): void {
	const game = startedGame(actor, gameId);
	const existing = findGoal(goalId);
	if (!existing || existing.gameId !== gameId) {
		throw new AppError('NOT_FOUND', { key: 'gamesheet.goalNotFound' });
	}
	const removed = deleteGoalRow(
		goalId,
		gameId,
		auditEntry(actor, {
			action: 'game.goal_deleted',
			entityType: 'game',
			entityId: gameId,
			metadata: { goalId, corrected: game.status === 'completed' }
		})
	);
	if (!removed) {
		throw new AppError('NOT_FOUND', { key: 'gamesheet.goalNotFound' });
	}
}

function resolvePenalty(game: GameView, input: PenaltyInput) {
	return resolvePenaltyEntry(
		game,
		input.team,
		input.playerId,
		nameOf(new Set([input.playerId]))
	);
}

export function addPenalty(
	actor: Actor,
	gameId: string,
	input: unknown
): GamePenaltyView {
	const game = startedGame(actor, gameId);
	const parsed = parseSchema(penaltyInputSchema, input);
	const player = resolvePenalty(game, parsed);
	const now = clock.nowMs();
	const id = newId('penalty');
	const row: NewGamePenaltyRow = {
		id,
		gameId,
		team: parsed.team,
		period: parsed.period,
		clock: parsed.clock,
		playerId: parsed.playerId,
		playerName: player.fullName,
		playerNumber: player.jerseyNumber,
		infraction: parsed.infraction,
		minutes: parsed.minutes,
		coincidental: parsed.coincidental,
		createdAt: now,
		createdBy: actor.kind === 'user' ? actor.userId : null,
		updatedAt: now
	};
	insertPenalty(
		row,
		auditEntry(actor, {
			action: 'game.penalty_added',
			entityType: 'game',
			entityId: gameId,
			metadata: {
				penaltyId: id,
				team: parsed.team,
				infraction: parsed.infraction,
				minutes: parsed.minutes
			}
		})
	);
	const created = findPenalty(id);
	if (!created) throw new AppError('INTERNAL');
	return penaltyView(created);
}

export function updatePenalty(
	actor: Actor,
	gameId: string,
	penaltyId: string,
	input: unknown
): GamePenaltyView {
	const game = startedGame(actor, gameId);
	const existing = findPenalty(penaltyId);
	if (!existing || existing.gameId !== gameId) {
		throw new AppError('NOT_FOUND', { key: 'gamesheet.penaltyNotFound' });
	}
	const parsed = parseSchema(penaltyInputSchema, input);
	const player = resolvePenalty(game, parsed);
	const patch: Partial<NewGamePenaltyRow> = {
		team: parsed.team,
		period: parsed.period,
		clock: parsed.clock,
		playerId: parsed.playerId,
		playerName: player.fullName,
		playerNumber: player.jerseyNumber,
		infraction: parsed.infraction,
		minutes: parsed.minutes,
		coincidental: parsed.coincidental,
		updatedAt: clock.nowMs()
	};
	const updated = updatePenaltyRow(
		penaltyId,
		gameId,
		patch,
		auditEntry(actor, {
			action: 'game.penalty_updated',
			entityType: 'game',
			entityId: gameId,
			metadata: { penaltyId }
		})
	);
	if (!updated) {
		throw new AppError('NOT_FOUND', { key: 'gamesheet.penaltyNotFound' });
	}
	const saved = findPenalty(penaltyId);
	if (!saved) throw new AppError('INTERNAL');
	return penaltyView(saved);
}

export function deletePenalty(
	actor: Actor,
	gameId: string,
	penaltyId: string
): void {
	startedGame(actor, gameId);
	const existing = findPenalty(penaltyId);
	if (!existing || existing.gameId !== gameId) {
		throw new AppError('NOT_FOUND', { key: 'gamesheet.penaltyNotFound' });
	}
	const removed = deletePenaltyRow(
		penaltyId,
		gameId,
		auditEntry(actor, {
			action: 'game.penalty_deleted',
			entityType: 'game',
			entityId: gameId,
			metadata: { penaltyId }
		})
	);
	if (!removed) {
		throw new AppError('NOT_FOUND', { key: 'gamesheet.penaltyNotFound' });
	}
}

/**
 * Termine le match et fige la feuille. Les corrections de buts restent
 * permises après ce geste; seuls les totaux et le statut changent d'état.
 */
export function finalizeGame(actor: Actor, gameId: string): void {
	completeGame(actor, gameId);
}

export type { GameGoalView, GamePenaltyView, GameSheetView, PlayerTotals };
