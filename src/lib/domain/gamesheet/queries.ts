import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { insertAudit, type AuditEntry } from '#lib/domain/audit/queries.ts';
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
