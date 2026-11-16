import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { session, user } from '#lib/server/db/auth.schema.ts';
import { ACCOUNT_LIMITS } from '#config/account.ts';

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

export function listAdminUserIds(): string[] {
	return db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.role, 'admin'))
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
