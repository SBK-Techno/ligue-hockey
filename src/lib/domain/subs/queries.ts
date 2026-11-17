import { and, asc, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { db, type DbExecutor } from '#lib/server/db/index.ts';
import { insertAudit, type AuditEntry } from '#lib/domain/audit/queries.ts';
import { subProfiles, subRequests, type SubRequestRow } from './schema.ts';

export type NewSubRequest = typeof subRequests.$inferInsert;

export function findSubProfile(playerId: string) {
	return db
		.select()
		.from(subProfiles)
		.where(eq(subProfiles.playerId, playerId))
		.get();
}

export function listSubProfiles() {
	return db.select().from(subProfiles).orderBy(asc(subProfiles.playerId)).all();
}

function upsertProfile(
	executor: DbExecutor,
	input: {
		playerId: string;
		favorite: boolean;
		positionsJson: string;
		updatedAt: number;
	}
): void {
	executor
		.insert(subProfiles)
		.values({
			playerId: input.playerId,
			favorite: input.favorite,
			positionsJson: input.positionsJson,
			createdAt: input.updatedAt,
			updatedAt: input.updatedAt
		})
		.onConflictDoUpdate({
			target: subProfiles.playerId,
			set: {
				favorite: input.favorite,
				positionsJson: input.positionsJson,
				updatedAt: input.updatedAt
			}
		})
		.run();
}

export function upsertSubProfile(input: {
	playerId: string;
	favorite: boolean;
	positionsJson: string;
	updatedAt: number;
}): void {
	upsertProfile(db, input);
}

/** La préférence et sa trace d'audit réussissent ou échouent ensemble. */
export function upsertSubProfileWithAudit(
	input: {
		playerId: string;
		favorite: boolean;
		positionsJson: string;
		updatedAt: number;
	},
	audit: AuditEntry
): void {
	db.transaction((tx) => {
		upsertProfile(tx, input);
		insertAudit(audit, tx);
	});
}

export function findRequest(id: string): SubRequestRow | undefined {
	return db.select().from(subRequests).where(eq(subRequests.id, id)).get();
}

export function findRequesterRequest(
	gameId: string,
	playerId: string
): SubRequestRow | undefined {
	return db
		.select()
		.from(subRequests)
		.where(
			and(
				eq(subRequests.gameId, gameId),
				eq(subRequests.requestedByPlayerId, playerId),
				inArray(subRequests.status, ['open', 'filled'])
			)
		)
		.get();
}

export function insertRequest(row: NewSubRequest): void {
	db.insert(subRequests).values(row).run();
}

export function claimRequest(
	id: string,
	playerId: string,
	at: number
): boolean {
	const result = db
		.update(subRequests)
		.set({
			status: 'filled',
			filledByPlayerId: playerId,
			filledAt: at
		})
		.where(and(eq(subRequests.id, id), eq(subRequests.status, 'open')))
		.run();
	return result.changes === 1;
}

export function releaseRequest(id: string, playerId: string): boolean {
	const result = db
		.update(subRequests)
		.set({
			status: 'open',
			filledByPlayerId: null,
			filledAt: null,
			cancelledAt: null
		})
		.where(
			and(
				eq(subRequests.id, id),
				eq(subRequests.status, 'filled'),
				eq(subRequests.filledByPlayerId, playerId)
			)
		)
		.run();
	return result.changes === 1;
}

export function cancelRequest(id: string, at: number): boolean {
	const result = db
		.update(subRequests)
		.set({
			status: 'cancelled',
			filledByPlayerId: null,
			filledAt: null,
			cancelledAt: at
		})
		.where(
			and(eq(subRequests.id, id), inArray(subRequests.status, ['open', 'filled']))
		)
		.run();
	return result.changes === 1;
}

/**
 * Ferme toutes les demandes d'un match. Une demande encore ouverte n'a pas de
 * remplaçant et part telle quelle; une demande comblée garde son remplaçant et
 * son heure, parce que l'historique du match doit continuer de dire qui a pris
 * la place.
 */
export function cancelOpenRequests(
	gameId: string,
	at: number,
	executor: DbExecutor = db
): number {
	const open = executor
		.update(subRequests)
		.set({ status: 'cancelled', cancelledAt: at })
		.where(and(eq(subRequests.gameId, gameId), eq(subRequests.status, 'open')))
		.run();
	const filled = executor
		.update(subRequests)
		.set({ status: 'cancelled', cancelledAt: at })
		.where(and(eq(subRequests.gameId, gameId), eq(subRequests.status, 'filled')))
		.run();
	return open.changes + filled.changes;
}

export function listRequestsForGame(gameId: string) {
	return db
		.select()
		.from(subRequests)
		.where(eq(subRequests.gameId, gameId))
		.orderBy(asc(subRequests.createdAt))
		.all();
}

export function listOpenRequests() {
	return db
		.select()
		.from(subRequests)
		.where(eq(subRequests.status, 'open'))
		.orderBy(asc(subRequests.createdAt))
		.all();
}

export function listRequestsForUser(userId: string) {
	return db
		.select()
		.from(subRequests)
		.where(
			and(
				inArray(subRequests.status, ['open', 'filled']),
				or(
					eq(subRequests.requestedByPlayerId, userId),
					eq(subRequests.filledByPlayerId, userId)
				)
			)
		)
		.orderBy(asc(subRequests.createdAt))
		.all();
}

export function listClaimedSubs(gameId: string) {
	return db
		.select({
			playerId: subRequests.filledByPlayerId,
			position: subRequests.position,
			filledAt: subRequests.filledAt,
			requestId: subRequests.id
		})
		.from(subRequests)
		.where(
			and(
				eq(subRequests.gameId, gameId),
				eq(subRequests.status, 'filled'),
				isNotNull(subRequests.filledByPlayerId)
			)
		)
		.all();
}
