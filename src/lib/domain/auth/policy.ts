import { AppError } from '#lib/shared/errors.ts';
import type { Actor, UserActor } from './types.ts';

const ADMIN_PERMISSIONS = [
	'managePlayers',
	'editRatings',
	'manageGames',
	'manageRules',
	'manageSettings',
	'manageSubs',
	'moderateChat',
	'recordPayments',
	'viewAllBalances',
	'viewAdmin'
] as const;

export type Permission = (typeof ADMIN_PERMISSIONS)[number];

export const PERMISSIONS: readonly Permission[] = ADMIN_PERMISSIONS;

export function can(actor: Actor, permission: Permission): boolean {
	if (actor.kind !== 'user' || actor.role !== 'admin') return false;
	return PERMISSIONS.includes(permission);
}

export function canViewBalance(actor: Actor, playerId: string): boolean {
	if (actor.kind !== 'user') return false;
	return actor.role === 'admin' || actor.userId === playerId;
}

export function canEditProfile(actor: Actor, playerId: string): boolean {
	if (actor.kind !== 'user') return false;
	return actor.role === 'admin' || actor.userId === playerId;
}

export function canCreatePoll(actor: Actor, allowPlayerPolls: boolean): boolean {
	if (actor.kind !== 'user') return false;
	return actor.role === 'admin' || allowPlayerPolls;
}

export function canViewRatings(actor: Actor): boolean {
	return can(actor, 'editRatings');
}

export function canManageGame(actor: Actor): boolean {
	return can(actor, 'manageGames');
}

export function canModerateChat(actor: Actor): boolean {
	return can(actor, 'moderateChat');
}

export function requireUser(actor: Actor): UserActor {
	if (actor.kind !== 'user') {
		throw new AppError('UNAUTHORIZED');
	}
	return actor;
}

export function requirePermission(actor: Actor, permission: Permission): UserActor {
	const user = requireUser(actor);
	if (!can(user, permission)) {
		throw new AppError('FORBIDDEN');
	}
	return user;
}

export function requireAdmin(actor: Actor): UserActor {
	return requirePermission(actor, 'viewAdmin');
}
