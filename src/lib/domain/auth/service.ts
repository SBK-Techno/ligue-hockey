import { z } from 'zod';
import { ACCOUNT_LIMITS, AUTH_POLICY } from '#config/account.ts';
import { DEFAULT_ROLE, isRole, type Role } from '#config/roles.ts';
import { identity } from '#lib/domain/auth/identity.ts';
import { requireUser } from '#lib/domain/auth/policy.ts';
import { deleteOtherSessions, findAccount, listSessions } from '#lib/domain/auth/queries.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import {
	changePasswordInputSchema,
	emailInputSchema,
	loginInputSchema,
	resetPasswordInputSchema
} from '#lib/domain/auth/validators.ts';
import { AppError } from '#lib/shared/errors.ts';
import { env } from '#lib/shared/config/env.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import { clearAttempts, consumeAttempt } from '#lib/server/security/throttle.ts';

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

/** Le chemin de retour d'une connexion reste interne à l'application. */
export function safeRedirectPath(value: string | null | undefined): string {
	if (
		!value ||
		!value.startsWith('/') ||
		value.startsWith('//') ||
		value.includes('\\') ||
		[...value].some((character) => character.charCodeAt(0) < 32)
	) {
		return '/';
	}
	return value;
}

export type AuthRequestContext = {
	/** L'adresse réelle du client, déjà résolue par le serveur. */
	address: string;
	headers: Headers;
};

function providerStatus(cause: unknown): number | undefined {
	return (
		(cause as { statusCode?: number; status?: number }).statusCode ??
		(cause as { status?: number }).status
	);
}

function loginKey(address: string, email: string): string {
	return `login:${address}:${email}`;
}

function resetKey(address: string, email: string): string {
	return `reset:${address}:${email}`;
}

/**
 * Le seul point de connexion : la réservation atomique du limiteur précède
 * l'appel au fournisseur, donc une rafale parallèle ne peut jamais dépasser
 * le plafond même si toutes les requêtes lisent avant la première écriture.
 */
export async function signIn(
	input: unknown,
	context: AuthRequestContext
): Promise<{ next: string }> {
	const parsed = parseSchema(loginInputSchema, input);
	const key = loginKey(context.address, parsed.email);
	const windowMs = env.security.loginWindowMinutes * 60_000;
	if (!consumeAttempt(key, env.security.maxLoginAttempts, windowMs)) {
		throw new AppError('RATE_LIMITED', { key: 'auth.throttled' });
	}

	try {
		await identity().signIn(
			{ email: parsed.email, password: parsed.password },
			context.headers
		);
	} catch (cause) {
		if (providerStatus(cause) === 429) {
			throw new AppError('RATE_LIMITED', { key: 'auth.throttled' });
		}
		throw new AppError('VALIDATION', { key: 'auth.invalid', cause });
	}
	clearAttempts(key);
	return { next: safeRedirectPath(parsed.next) };
}

/**
 * Ferme la session de la requête. Le fournisseur reste derrière le port :
 * aucune route ne le connaît.
 */
export async function signOut(headers: Headers): Promise<void> {
	await identity().signOut(headers);
}

/**
 * Change le mot de passe du membre connecté. La politique de mot de passe et
 * le limiteur vivent ici, pas dans l'action de la page.
 */
export async function changeOwnPassword(
	actor: Actor,
	input: unknown,
	headers: Headers
): Promise<void> {
	const user = requireUser(actor);
	const parsed = parseSchema(changePasswordInputSchema, input);
	if (parsed.newPassword !== parsed.confirm) {
		throw new AppError('VALIDATION', {
			key: 'invite.mismatch',
			details: [{ path: 'confirm' }]
		});
	}

	const key = `password:${user.userId}`;
	const windowMs = AUTH_POLICY.passwordWindowSeconds * 1000;
	if (!consumeAttempt(key, env.security.passwordChangesPerHour, windowMs)) {
		throw new AppError('RATE_LIMITED', { key: 'auth.throttled' });
	}

	try {
		await identity().changePassword(
			user.userId,
			{
				currentPassword: parsed.currentPassword,
				newPassword: parsed.newPassword
			},
			headers
		);
	} catch (cause) {
		const status = providerStatus(cause);
		if (status === 400) {
			throw new AppError('VALIDATION', {
				key: 'profile.currentPasswordInvalid',
				details: [{ path: 'currentPassword' }],
				cause
			});
		}
		if (status === 429) {
			throw new AppError('RATE_LIMITED', { key: 'auth.throttled' });
		}
		throw cause;
	}
	clearAttempts(key);
}

/** Demande un lien de réinitialisation, limité par adresse et par courriel. */
export async function requestPasswordReset(
	input: unknown,
	context: Pick<AuthRequestContext, 'address'>
): Promise<void> {
	const parsed = parseSchema(emailInputSchema, input);
	const key = resetKey(context.address, parsed.email);
	const windowMs = AUTH_POLICY.passwordWindowSeconds * 1000;
	if (!consumeAttempt(key, env.security.resetRequestsPerHour, windowMs)) {
		throw new AppError('RATE_LIMITED', { key: 'auth.throttled' });
	}

	try {
		await identity().requestPasswordReset(parsed.email, 'reset');
	} catch (cause) {
		if (providerStatus(cause) === 429) {
			throw new AppError('RATE_LIMITED', { key: 'auth.throttled' });
		}
		throw cause;
	}
}

/** Consomme le jeton d'invitation ou de réinitialisation. */
export async function resetPassword(input: unknown): Promise<void> {
	const parsed = parseSchema(resetPasswordInputSchema, input);
	if (parsed.password !== parsed.confirm) {
		throw new AppError('VALIDATION', {
			key: 'invite.mismatch',
			details: [{ path: 'confirm' }]
		});
	}

	try {
		await identity().resetPassword({
			token: parsed.token,
			newPassword: parsed.password
		});
	} catch (cause) {
		if (providerStatus(cause) === 400) {
			throw new AppError('VALIDATION', { key: 'invite.expired', cause });
		}
		throw cause;
	}
}
