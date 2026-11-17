import type { Capability } from '#config/capabilities.ts';
import { ADMIN_ROLE, roleCapabilities, roleHasCapability } from '#config/roles.ts';
import { AppError } from '#lib/shared/errors.ts';
import type { Actor, UserActor } from './types.ts';

/**
 * Les services demandent une capacité, jamais un rôle. Un nouveau rôle se
 * déclare donc uniquement dans `config/roles.ts`.
 */
export type Permission = Capability;

/**
 * La seule porte de l'activité : un acteur inactif n'est jamais un
 * utilisateur, même forgé avec un rôle. Toutes les questions de capacité
 * passent par ici, y compris l'accès à son propre profil ou à son solde.
 */
function activeUser(actor: Actor): UserActor | null {
  return actor.kind === 'user' && actor.active ? actor : null;
}

export function capabilitiesOf(actor: Actor): readonly Capability[] {
  const user = activeUser(actor);
  return user ? roleCapabilities(user.role) : [];
}

export function can(actor: Actor, permission: Permission): boolean {
  const user = activeUser(actor);
  return user !== null && roleHasCapability(user.role, permission);
}

export function canAny(actor: Actor, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(actor, permission));
}

export function canViewBalance(actor: Actor, playerId: string): boolean {
  const user = activeUser(actor);
  return user !== null && (can(user, 'viewAllBalances') || user.userId === playerId);
}

export function canEditProfile(actor: Actor, playerId: string): boolean {
  const user = activeUser(actor);
  return user !== null && (can(user, 'managePlayers') || user.userId === playerId);
}

export type PlayerDeletionVerdict = 'allowed' | 'self' | 'admin' | 'forbidden';

/**
 * La seule règle de suppression d'un joueur. La page et le service lisent ce
 * verdict; ni l'un ni l'autre ne compare un rôle.
 */
export function playerDeletion(
  actor: Actor,
  target: { userId: string; role: string | null }
): PlayerDeletionVerdict {
  const user = activeUser(actor);
  if (!user || !roleHasCapability(user.role, 'deletePlayer')) return 'forbidden';
  if (user.userId === target.userId) return 'self';
  if (target.role === ADMIN_ROLE) return 'admin';
  return 'allowed';
}

export function canDeletePlayer(
  actor: Actor,
  target: { userId: string; role: string | null }
): boolean {
  return playerDeletion(actor, target) === 'allowed';
}

export function canCreatePoll(actor: Actor, allowPlayerPolls: boolean): boolean {
  const user = activeUser(actor);
  return user !== null && (can(user, 'moderateChat') || allowPlayerPolls);
}

export function canManageGame(actor: Actor): boolean {
  return can(actor, 'manageGames');
}

export function canModerateChat(actor: Actor): boolean {
  return can(actor, 'moderateChat');
}

export function requireUser(actor: Actor): UserActor {
  const user = activeUser(actor);
  if (!user) {
    throw new AppError('UNAUTHORIZED');
  }
  return user;
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
