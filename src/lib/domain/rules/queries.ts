import { and, asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { pairRules, type PairRuleRow } from './schema.ts';

export function listPairRules(): PairRuleRow[] {
	return db.select().from(pairRules).orderBy(asc(pairRules.createdAt)).all();
}

export function findPairRule(
	playerAId: string,
	playerBId: string
): PairRuleRow | undefined {
	return db
		.select()
		.from(pairRules)
		.where(
			and(
				eq(pairRules.playerAId, playerAId),
				eq(pairRules.playerBId, playerBId)
			)
		)
		.get();
}

export function insertPairRule(row: typeof pairRules.$inferInsert): void {
	db.insert(pairRules).values(row).run();
}

export function deletePairRule(id: string): void {
	db.delete(pairRules).where(eq(pairRules.id, id)).run();
}
