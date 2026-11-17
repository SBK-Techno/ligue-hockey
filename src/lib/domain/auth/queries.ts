import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { insertAudit, type AuditEntry } from '#lib/domain/audit/queries.ts';
import { session, user } from '#lib/server/db/auth.schema.ts';
import { ACCOUNT_LIMITS } from '#config/account.ts';
import { ROLES } from '#config/roles.ts';
import type { Capability } from '#config/capabilities.ts';

export type AccountRow = {
	id: string;
	name: string;
	email: string;
	role: string | null;
	createdAt: Date;
};

export type SessionRow = {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	expiresAt: Date;
	userAgent: string | null;
};

export function listUserIdsWithCapability(capability: Capability): string[] {
	const roles = ROLES.filter((role) =>
		(role.capabilities as readonly Capability[]).includes(capability)
	).map((role) => role.key);
	if (roles.length === 0) return [];
	return db
		.select({ id: user.id })
		.from(user)
		.where(inArray(user.role, roles))
		.all()
		.map((row) => row.id);
}

export function findAccount(userId: string): AccountRow | undefined {
	return db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			createdAt: user.createdAt
		})
		.from(user)
		.where(eq(user.id, userId))
		.get();
}

export function listSessions(userId: string): SessionRow[] {
	return db
		.select({
			id: session.id,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			expiresAt: session.expiresAt,
			userAgent: session.userAgent
		})
		.from(session)
		.where(eq(session.userId, userId))
		.orderBy(desc(session.updatedAt))
		.limit(ACCOUNT_LIMITS.sessionListMax)
		.all();
}

export function deleteOtherSessions(userId: string, currentSessionId: string): number {
	return db
		.delete(session)
		.where(and(eq(session.userId, userId), ne(session.id, currentSessionId)))
		.run().changes;
}

/**
 * Le rôle et sa trace d'audit sont une seule écriture : une trace manquée ne
 * peut pas laisser un privilège accordé sans preuve.
 */
export function setUserRole(userId: string, role: string, audit: AuditEntry): void {
	db.transaction((tx) => {
		tx.update(user).set({ role }).where(eq(user.id, userId)).run();
		insertAudit(audit, tx);
	});
}
