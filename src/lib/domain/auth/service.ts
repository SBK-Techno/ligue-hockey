import { z } from 'zod';
import { ACCOUNT_LIMITS } from '#config/account.ts';
import { DEFAULT_ROLE, isRole, type Role } from '#config/roles.ts';
import { identity } from '#lib/domain/auth/identity.ts';
import { requireUser } from '#lib/domain/auth/policy.ts';
import { deleteOtherSessions, findAccount, listSessions } from '#lib/domain/auth/queries.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { AppError } from '#lib/shared/errors.ts';
import { parseSchema } from '#lib/shared/validation.ts';

const emailSchema = z.object({
	email: z.string().trim().toLowerCase().email().max(254)
});

const displayNameSchema = z.object({
	displayName: z.string().trim().min(1).max(ACCOUNT_LIMITS.displayNameMax)
});

export type AccountView = {
	id: string;
	name: string;
	email: string;
	role: Role;
	createdAt: number;
};

export type SessionView = {
	id: string;
	createdAt: number;
	updatedAt: number;
	expiresAt: number;
	userAgent: string | null;
};

export function getOwnAccount(actor: Actor): AccountView {
	const user = requireUser(actor);
	const row = findAccount(user.userId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.accountNotFound' });
	}
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role && isRole(row.role) ? row.role : DEFAULT_ROLE,
		createdAt: row.createdAt.getTime()
	};
}

export async function updateOwnDisplayName(actor: Actor, input: unknown): Promise<AccountView> {
	const user = requireUser(actor);
	const parsed = parseSchema(displayNameSchema, input);
	await identity().updateName(user.userId, parsed.displayName);
	return getOwnAccount(actor);
}

export function listOwnSessions(actor: Actor): SessionView[] {
	const user = requireUser(actor);
	return listSessions(user.userId).map((row) => ({
		id: row.id,
		createdAt: row.createdAt.getTime(),
		updatedAt: row.updatedAt.getTime(),
		expiresAt: row.expiresAt.getTime(),
		userAgent: row.userAgent
	}));
}

export function revokeOwnOtherSessions(actor: Actor, currentSessionId: string): number {
	const user = requireUser(actor);
	if (!currentSessionId) {
		throw new AppError('INTERNAL', { key: 'error.sessionRequired' });
	}
	return deleteOtherSessions(user.userId, currentSessionId);
}

export async function requestPasswordResetLink(input: unknown): Promise<void> {
	const parsed = parseSchema(emailSchema, input);
	await identity().requestPasswordReset(parsed.email, 'reset');
}
