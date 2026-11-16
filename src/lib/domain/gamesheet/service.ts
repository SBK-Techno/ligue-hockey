import { TEAMS, type Team } from '#config/teams.ts';
import { requirePermission, requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { auditEntry } from '#lib/domain/audit/service.ts';
import { getGame, completeGame, type GameView } from '#lib/domain/games/service.ts';
import { isGameStarted } from '#lib/domain/games/playability.ts';
import type { GamePlayer } from '#lib/domain/games/types.ts';
import { playersByIds } from '#lib/domain/players/candidates.ts';
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
	type GoalInput,
	type PenaltyInput
} from './validators.ts';

function playerRef(
	team: Team,
	playerId: string | null,
	fullName: string,
	jerseyNumber: number | null
): GamePlayerRef {
	return {
		playerId: playerId ?? '',
		fullName,
		jerseyNumber,
		team
	};
}

function goalView(row: GameGoalRow): GameGoalView {
	const assists: GamePlayerRef[] = [];
	if (row.assist1Name !== null) {
		assists.push(
			playerRef(
				row.team,
				row.assist1PlayerId,
				row.assist1Name,
				row.assist1Number
			)
		);
	}
	if (row.assist2Name !== null) {
		assists.push(
			playerRef(
				row.team,
				row.assist2PlayerId,
				row.assist2Name,
				row.assist2Number
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
			row.team,
			row.scorerPlayerId,
			row.scorerName,
			row.scorerNumber
		),
		assists,
		ownGoal: row.kind === 'own_goal',
		penaltyShot: row.kind === 'penalty_shot'
	};
}

function penaltyView(row: GamePenaltyRow): GamePenaltyView {
	return {
		id: row.id,
		team: row.team,
		period: row.period,
		clock: row.clock,
		player: playerRef(
			row.team,
			row.playerId,
			row.playerName,
			row.playerNumber
		),
		infraction: row.infraction,
		minutes: row.minutes,
		coincidental: row.coincidental
	};
}

function dressedKey(team: Team, playerId: string): string {
	return `${team}:${playerId}`;
}

function dressedSlots(game: GameView): Map<string, GamePlayer> {
	const slots = new Map<string, GamePlayer>();
	for (const slot of game.slots) {
		if (!slot.player) continue;
		slots.set(dressedKey(slot.team, slot.player.playerId), slot.player);
	}
	return slots;
}

function nameOf(playerIds: ReadonlySet<string>): Map<string, string> {
	return new Map(
		playersByIds([...playerIds]).map((player) => [
			player.userId,
			player.fullName
		])
	);
}

function requireDressed(
	slots: ReadonlyMap<string, GamePlayer>,
	team: Team,
	playerId: string,
	names: ReadonlyMap<string, string>,
	key:
		| 'gamesheet.scorerNotDressed'
		| 'gamesheet.assistNotDressed'
		| 'gamesheet.penaltyPlayerNotDressed'
): GamePlayer {
	const player = slots.get(dressedKey(team, playerId));
	if (!player) {
		throw new AppError('VALIDATION', {
			key,
			params: { name: names.get(playerId) ?? playerId }
		});
	}
	return player;
}

/**
 * Vérifie que le but appartient bien à des joueurs habillés de la même équipe.
 * Le gardien peut marquer ou être crédité d'une aide : il occupe une place
 * comme les autres et aucune position ne restreint la feuille.
 */
function resolveGoal(
	game: GameView,
	input: GoalInput
): {
	scorer: GamePlayer;
	assists: { slot: GamePlayer; playerId: string }[];
} {
	const slots = dressedSlots(game);
	const ids = new Set(
		[input.scorerPlayerId, input.assist1PlayerId, input.assist2PlayerId].filter(
			(value): value is string => value !== null
		)
	);
	const names = nameOf(ids);
	const scorer = requireDressed(
		slots,
		input.team,
		input.scorerPlayerId,
		names,
		'gamesheet.scorerNotDressed'
	);

	const assistIds = [input.assist1PlayerId, input.assist2PlayerId].filter(
		(value): value is string => value !== null
	);
	const seen = new Set<string>();
	for (const assistId of assistIds) {
		if (assistId === input.scorerPlayerId) {
			throw new AppError('VALIDATION', { key: 'gamesheet.assistIsScorer' });
		}
		if (seen.has(assistId)) {
			throw new AppError('VALIDATION', { key: 'gamesheet.assistDuplicate' });
		}
		seen.add(assistId);
	}
	for (const assistId of assistIds) {
		const slot = requireDressed(
			slots,
			input.team,
			assistId,
			names,
			'gamesheet.assistNotDressed'
		);
		if (slot.fullName === scorer.fullName) {
			throw new AppError('VALIDATION', {
				key: 'gamesheet.assistDuplicateName',
				params: { name: slot.fullName }
			});
		}
	}

	return {
		scorer,
		assists: assistIds.map((playerId) => ({
			playerId,
			slot: slots.get(dressedKey(input.team, playerId))!
		}))
	};
}

function startedGame(actor: Actor, gameId: string): GameView {
	requirePermission(actor, 'manageGames');
	const game = getGame(actor, gameId);
	if (game.status === 'cancelled') {
		throw new AppError('CONFLICT', { key: 'gamesheet.cancelled' });
	}
	if (!isGameStarted(game)) {
		throw new AppError('CONFLICT', { key: 'games.notStarted' });
	}
	return game;
}

/**
 * Feuille de match complète : buts, pénalités, score et totaux par joueur
 * habillé. Aucune note et aucun solde n'entrent dans ce modèle.
 */
export function getGameSheet(actor: Actor, gameId: string): GameSheetView {
	requireUser(actor);
	const game = getGame(actor, gameId);
	const goals = listGoals(gameId);
	const penalties = listPenalties(gameId);

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
		if (goal.scorerPlayerId) {
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
		.map((entry) => ({ ...entry, points: entry.goals + entry.assists }))
		.sort(
			(a, b) =>
				(teamOrder.get(a.team) ?? 0) - (teamOrder.get(b.team) ?? 0) ||
				(a.jerseyNumber ?? Number.MAX_SAFE_INTEGER) -
					(b.jerseyNumber ?? Number.MAX_SAFE_INTEGER) ||
				a.fullName.localeCompare(b.fullName) ||
				a.playerId.localeCompare(b.playerId)
		);

	return {
		gameId,
		goals: goals.map(goalView),
		penalties: penalties.map(penaltyView),
		score,
		totals: rows,
		finalized: game.completedAt !== null
	};
}

export function addGoal(actor: Actor, gameId: string, input: unknown): GameGoalView {
	const game = startedGame(actor, gameId);
	const parsed = parseSchema(goalInputSchema, input);
	const resolved = resolveGoal(game, parsed);
	const now = clock.nowMs();
	const id = newId('goal');
	const row: NewGameGoalRow = {
		id,
		gameId,
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
		createdAt: now,
		createdBy: actor.kind === 'user' ? actor.userId : null,
		updatedAt: now
	};
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
	const resolved = resolveGoal(game, parsed);
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

function resolvePenalty(
	game: GameView,
	input: PenaltyInput
): GamePlayer {
	const slots = dressedSlots(game);
	const names = nameOf(new Set([input.playerId]));
	return requireDressed(
		slots,
		input.team,
		input.playerId,
		names,
		'gamesheet.penaltyPlayerNotDressed'
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
