import type { Capability } from '#config/capabilities.ts';
import { roleCapabilities, roleHasCapability } from '#config/roles.ts';
import { AppError } from '#lib/shared/errors.ts';
import type { Actor, UserActor } from './types.ts';

/**
 * Les services demandent une capacité, jamais un rôle. Un nouveau rôle se
 * déclare donc uniquement dans `config/roles.ts`.
 */
export type Permission = Capability;

export function capabilitiesOf(actor: Actor): readonly Capability[] {
  return actor.kind === 'user' ? roleCapabilities(actor.role) : [];
}

export function can(actor: Actor, permission: Permission): boolean {
  return actor.kind === 'user' && roleHasCapability(actor.role, permission);
}

export function canAny(actor: Actor, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(actor, permission));
}

export function canViewBalance(actor: Actor, playerId: string): boolean {
  if (actor.kind !== 'user') return false;
  return can(actor, 'viewAllBalances') || actor.userId === playerId;
}

export function canEditProfile(actor: Actor, playerId: string): boolean {
  if (actor.kind !== 'user') return false;
  return can(actor, 'managePlayers') || actor.userId === playerId;
}

export function canCreatePoll(actor: Actor, allowPlayerPolls: boolean): boolean {
  if (actor.kind !== 'user') return false;
  return can(actor, 'moderateChat') || allowPlayerPolls;
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
