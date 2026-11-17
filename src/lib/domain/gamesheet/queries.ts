import { and, asc, count, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { insertAudit, type AuditEntry } from '#lib/domain/audit/queries.ts';
import { gameSlots, games } from '#lib/domain/games/schema.ts';
import {
	gameGoals,
	gamePenalties,
	type NewGameGoalRow,
	type NewGamePenaltyRow
} from './schema.ts';

export function listGoals(gameId: string) {
	return db
		.select()
		.from(gameGoals)
		.where(eq(gameGoals.gameId, gameId))
		.orderBy(asc(gameGoals.period), desc(gameGoals.clock), asc(gameGoals.createdAt))
		.all();
}

/** Le total de buts par équipe pour plusieurs matchs, en une lecture. */
export function listGoalTotals(gameIds: readonly string[]) {
	if (gameIds.length === 0) return [];
	return db
		.select({ gameId: gameGoals.gameId, team: gameGoals.team, goals: count() })
		.from(gameGoals)
		.where(inArray(gameGoals.gameId, [...gameIds]))
		.groupBy(gameGoals.gameId, gameGoals.team)
		.all();
}

export function findGoal(goalId: string) {
	return db.select().from(gameGoals).where(eq(gameGoals.id, goalId)).get();
}

export function insertGoal(goal: NewGameGoalRow, audit: AuditEntry): void {
	db.transaction((tx) => {
		tx.insert(gameGoals).values(goal).run();
		insertAudit(audit, tx);
	});
}

export function updateGoal(
	goalId: string,
	gameId: string,
	patch: Partial<NewGameGoalRow>,
	audit: AuditEntry
): boolean {
	return db.transaction((tx) => {
		const result = tx
			.update(gameGoals)
			.set(patch)
			.where(and(eq(gameGoals.id, goalId), eq(gameGoals.gameId, gameId)))
			.run();
		if (result.changes !== 1) return false;
		insertAudit(audit, tx);
		return true;
	});
}

export function deleteGoal(
	goalId: string,
	gameId: string,
	audit: AuditEntry
): boolean {
	return db.transaction((tx) => {
		const result = tx
			.delete(gameGoals)
			.where(and(eq(gameGoals.id, goalId), eq(gameGoals.gameId, gameId)))
			.run();
		if (result.changes !== 1) return false;
		insertAudit(audit, tx);
		return true;
	});
}

export function listPenalties(gameId: string) {
	return db
		.select()
		.from(gamePenalties)
		.where(eq(gamePenalties.gameId, gameId))
		.orderBy(
			asc(gamePenalties.period),
			desc(gamePenalties.clock),
			asc(gamePenalties.createdAt)
		)
		.all();
}

export function findPenalty(penaltyId: string) {
	return db
		.select()
		.from(gamePenalties)
		.where(eq(gamePenalties.id, penaltyId))
		.get();
}

export function insertPenalty(
	penalty: NewGamePenaltyRow,
	audit: AuditEntry
): void {
	db.transaction((tx) => {
		tx.insert(gamePenalties).values(penalty).run();
		insertAudit(audit, tx);
	});
}

export function updatePenalty(
	penaltyId: string,
	gameId: string,
	patch: Partial<NewGamePenaltyRow>,
	audit: AuditEntry
): boolean {
	return db.transaction((tx) => {
		const result = tx
			.update(gamePenalties)
			.set(patch)
			.where(
				and(
					eq(gamePenalties.id, penaltyId),
					eq(gamePenalties.gameId, gameId)
				)
			)
			.run();
		if (result.changes !== 1) return false;
		insertAudit(audit, tx);
		return true;
	});
}

export function deletePenalty(
	penaltyId: string,
	gameId: string,
	audit: AuditEntry
): boolean {
	return db.transaction((tx) => {
		const result = tx
			.delete(gamePenalties)
			.where(
				and(
					eq(gamePenalties.id, penaltyId),
					eq(gamePenalties.gameId, gameId)
				)
			)
			.run();
		if (result.changes !== 1) return false;
		insertAudit(audit, tx);
		return true;
	});
}


export type PlayerSeasonStats = {
	games: number;
	goals: number;
	assists: number;
	penalties: number;
};

/**
 * Les totaux de saison d'un joueur, calculés sur les matchs terminés seulement.
 * Un but contre son camp crédite l'équipe, jamais le joueur : il reste exclu de
 * ses buts personnels. Une lecture par agrégat, sans charger les événements.
 */
export function playerSeasonStats(playerId: string): PlayerSeasonStats {
	const gamesRow = db
		.select({ total: sql<number>`count(distinct ${gameSlots.gameId})` })
		.from(gameSlots)
		.innerJoin(games, eq(gameSlots.gameId, games.id))
		.where(
			and(
				eq(gameSlots.assignedPlayerId, playerId),
				eq(games.status, 'completed')
			)
		)
		.get();
	const goalsRow = db
		.select({ total: count() })
		.from(gameGoals)
		.innerJoin(games, eq(gameGoals.gameId, games.id))
		.where(
			and(
				eq(gameGoals.scorerPlayerId, playerId),
				ne(gameGoals.kind, 'own_goal'),
				eq(games.status, 'completed')
			)
		)
		.get();
	const assistsRow = db
		.select({ total: count() })
		.from(gameGoals)
		.innerJoin(games, eq(gameGoals.gameId, games.id))
		.where(
			and(
				or(
					eq(gameGoals.assist1PlayerId, playerId),
					eq(gameGoals.assist2PlayerId, playerId)
				),
				eq(games.status, 'completed')
			)
		)
		.get();
	const penaltiesRow = db
		.select({ total: count() })
		.from(gamePenalties)
		.innerJoin(games, eq(gamePenalties.gameId, games.id))
		.where(
			and(
				eq(gamePenalties.playerId, playerId),
				eq(games.status, 'completed')
			)
		)
		.get();

	return {
		games: Number(gamesRow?.total ?? 0),
		goals: Number(goalsRow?.total ?? 0),
		assists: Number(assistsRow?.total ?? 0),
		penalties: Number(penaltiesRow?.total ?? 0)
	};
}
