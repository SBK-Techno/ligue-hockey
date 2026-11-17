import type { Position } from '#config/positions.ts';
import { DEFAULT_ROLE, isRole, type Role } from '#config/roles.ts';
import type { AvatarId } from '#config/avatars.ts';
import { branding } from '#lib/generated/branding.ts';
import { can, requirePermission, requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { identity } from '#lib/domain/auth/identity.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { regenerateUpcomingGeneratedGames } from '#lib/domain/games/upcoming.ts';
import { AppError } from '#lib/shared/errors.ts';
import { newToken } from '#lib/shared/ids/id.ts';
import { logger } from '#lib/shared/logging/logger.ts';
import { clock, timeInZone, todayInZone } from '#lib/shared/time/clock.ts';
import {
	deletePlayerAccount,
	findPlayer,
	findPlayerWithEmail,
	insertPlayer,
	listActiveAvatarAssignments,
	listActivePlayers,
	listAllPlayersWithEmail,
	updatePlayer
} from './queries.ts';
import { firstFreeAvatarId, resolveAvatarId } from './identity.ts';
import { toPublic } from './public.ts';
import type {
	AdminUpdatePlayerInput,
	InvitePlayerInput,
	UpdateOwnProfileInput
} from './validators.ts';

export type PublicPlayer = {
	userId: string;
	firstName: string;
	lastName: string;
	fullName: string;
	position: Position;
	jerseyNumber: number | null;
	avatarId: string | null;
	isSubstitute: boolean;
	active: boolean;
};

export type SelfProfile = PublicPlayer & {
	email: string;
	age: number;
};

export type AdminPlayer = SelfProfile & {
	role: Role;
};

function isDuplicateEmail(error: unknown): boolean {
	const code = (error as { body?: { code?: string } }).body?.code;
	return code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' || code === 'USER_ALREADY_EXISTS';
}

function requireVisible(actor: Actor, playerId: string) {
	const user = requireUser(actor);
	const row = findPlayerWithEmail(playerId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	if (can(user, 'managePlayers') || user.userId === playerId) {
		return { row, isAdmin: can(user, 'managePlayers') };
	}
	if (!row.active) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	return { row, isAdmin: false };
}

function toAdmin(row: ReturnType<typeof findPlayerWithEmail>): AdminPlayer {
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	return {
		...toPublic(row),
		email: row.email,
		age: row.age,
		role: row.role && isRole(row.role) ? row.role : DEFAULT_ROLE
	};
}

export type AvatarPickerView = {
	selected: AvatarId;
	taken: AvatarId[];
};

/**
 * The displayed identity of every active player, whether the avatar is stored
 * or derived. Two active players must never share the same appearance.
 */
function activeAvatarUsage(): { userId: string; avatarId: AvatarId }[] {
	return listActiveAvatarAssignments().map((row) => ({
		userId: row.userId,
		avatarId: resolveAvatarId(row.userId, row.avatarId)
	}));
}

function takenAvatarIds(playerId: string): AvatarId[] {
	return [
		...new Set(
			activeAvatarUsage()
				.filter((entry) => entry.userId !== playerId)
				.map((entry) => entry.avatarId)
		)
	];
}

function assertAvatarAvailable(playerId: string, avatarId: AvatarId): void {
	if (takenAvatarIds(playerId).includes(avatarId)) {
		throw new AppError('CONFLICT', { key: 'error.avatarTaken' });
	}
}

function nextFreeAvatarId(): AvatarId | null {
	return firstFreeAvatarId(activeAvatarUsage().map((entry) => entry.avatarId));
}

export function isSubstitutePlayer(actor: Actor): boolean {
	const user = requireUser(actor);
	return findPlayer(user.userId)?.isSubstitute ?? false;
}

export function listRoster(actor: Actor): PublicPlayer[] {
	requireUser(actor);
	return listActivePlayers().map(toPublic);
}

export function listAdminPlayers(actor: Actor): AdminPlayer[] {
	requirePermission(actor, 'managePlayers');
	return listAllPlayersWithEmail().map(toAdmin);
}

/**
 * Liste minimale pour les évaluations : la capacité de noter suffit, sans
 * exiger l'administration complète des joueurs.
 */
export function listRatingPlayers(actor: Actor): PublicPlayer[] {
	requirePermission(actor, 'editRatings');
	return listAllPlayersWithEmail().map(toPublic);
}

export function findOwnProfile(actor: Actor): SelfProfile | null {
	const user = requireUser(actor);
	const row = findPlayerWithEmail(user.userId);
	return row
		? {
				...toPublic(row),
				email: row.email,
				age: row.age
			}
		: null;
}

export function getOwnProfile(actor: Actor): SelfProfile {
	const profile = findOwnProfile(actor);
	if (!profile) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	return profile;
}

export function getOwnAvatarPicker(actor: Actor): AvatarPickerView {
	const user = requireUser(actor);
	const row = findPlayer(user.userId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	return {
		selected: resolveAvatarId(row.userId, row.avatarId),
		taken: takenAvatarIds(row.userId)
	};
}

export function getAdminAvatarPicker(actor: Actor, playerId: string): AvatarPickerView {
	requirePermission(actor, 'managePlayers');
	const row = findPlayer(playerId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	return {
		selected: resolveAvatarId(row.userId, row.avatarId),
		taken: takenAvatarIds(row.userId)
	};
}

export function getPlayer(actor: Actor, playerId: string): SelfProfile | PublicPlayer {
	const { row, isAdmin } = requireVisible(actor, playerId);
	if (isAdmin || (actor.kind === 'user' && actor.userId === playerId)) {
		return { ...toPublic(row), email: row.email, age: row.age };
	}
	return toPublic(row);
}

export function getAdminPlayer(actor: Actor, playerId: string): AdminPlayer {
	requirePermission(actor, 'managePlayers');
	const row = findPlayerWithEmail(playerId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	return toAdmin(row);
}

export async function invitePlayer(
	actor: Actor,
	input: InvitePlayerInput
): Promise<{ userId: string; inviteQueued: boolean }> {
	requirePermission(actor, 'managePlayers');

	let created: { id: string };
	try {
		created = await identity().createUser({
			email: input.email,
			name: `${input.firstName} ${input.lastName}`,
			role: 'player',
			password: newToken()
		});
	} catch (cause) {
		if (isDuplicateEmail(cause)) {
			throw new AppError('CONFLICT', { key: 'admin.emailExists', cause });
		}
		throw new AppError('INTERNAL', { key: 'admin.playerCreateFailed', cause });
	}

	try {
		const now = clock.nowMs();
		insertPlayer({
			userId: created.id,
			firstName: input.firstName,
			lastName: input.lastName,
			position: input.position,
			age: input.age,
			jerseyNumber: input.jerseyNumber ?? null,
			avatarId: nextFreeAvatarId(),
			isSubstitute: input.isSubstitute,
			active: true,
			createdAt: now,
			updatedAt: now
		});
	} catch (cause) {
		try {
			await identity().deleteUser(created.id);
		} catch (cleanupError) {
			logger.error('players.invite_rollback_failed', {
				userId: created.id,
				error: cleanupError
			});
			throw new AppError('INTERNAL', {
				key: 'admin.playerCreateFailed',
				cause
			});
		}
		throw new AppError('CONFLICT', {
			key: 'admin.playerCreateFailed',
			cause
		});
	}

	let inviteQueued = true;
	try {
		await identity().requestPasswordReset(input.email, 'invitation');
	} catch (error) {
		inviteQueued = false;
		logger.error('players.invite_email_failed', {
			userId: created.id,
			error
		});
	}

	recordAudit(actor, {
		action: 'player.invite',
		entityType: 'player',
		entityId: created.id,
		metadata: { position: input.position, inviteQueued }
	});
	regenerateUpcomingGeneratedGames();

	return { userId: created.id, inviteQueued };
}

export async function resendInvite(actor: Actor, playerId: string): Promise<void> {
	requirePermission(actor, 'managePlayers');
	const row = findPlayerWithEmail(playerId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}

	try {
		await identity().requestPasswordReset(row.email, 'reset');
	} catch (cause) {
		throw new AppError('INTERNAL', { key: 'admin.inviteFailed', cause });
	}

	recordAudit(actor, {
		action: 'player.invite_resent',
		entityType: 'player',
		entityId: playerId
	});
}

export async function updateOwnProfile(
	actor: Actor,
	input: UpdateOwnProfileInput
): Promise<SelfProfile> {
	const user = requireUser(actor);
	const row = findPlayer(user.userId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}

	const patch: Parameters<typeof updatePlayer>[1] = {
		firstName: input.firstName,
		lastName: input.lastName,
		age: input.age,
		position: input.position,
		jerseyNumber: input.jerseyNumber
	};
	if (input.avatarId !== undefined && input.avatarId !== row.avatarId) {
		assertAvatarAvailable(user.userId, input.avatarId);
		patch.avatarId = input.avatarId;
	}
	const cleared = updatePlayer(user.userId, patch);
	await identity().updateName(user.userId, `${input.firstName} ${input.lastName}`);
	recordAudit(actor, {
		action: 'player.self_update',
		entityType: 'player',
		entityId: user.userId,
		metadata: cleared.length > 0 ? { positionRatingsCleared: cleared } : undefined
	});
	regenerateUpcomingGeneratedGames();
	return getOwnProfile(actor);
}

export async function adminUpdatePlayer(
	actor: Actor,
	playerId: string,
	input: AdminUpdatePlayerInput
): Promise<AdminPlayer> {
	requirePermission(actor, 'managePlayers');
	const row = findPlayerWithEmail(playerId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}

	const patch: Parameters<typeof updatePlayer>[1] = {};
	if (input.firstName !== undefined) patch.firstName = input.firstName;
	if (input.lastName !== undefined) patch.lastName = input.lastName;
	if (input.age !== undefined) patch.age = input.age;
	if (input.position !== undefined) patch.position = input.position;
	if (input.jerseyNumber !== undefined) patch.jerseyNumber = input.jerseyNumber;
	if (input.avatarId !== undefined && input.avatarId !== row.avatarId) {
		assertAvatarAvailable(playerId, input.avatarId);
		patch.avatarId = input.avatarId;
	}
	if (input.isSubstitute !== undefined) patch.isSubstitute = input.isSubstitute;
	if (input.active !== undefined) patch.active = input.active;

	const cleared = updatePlayer(playerId, patch);
	if (input.firstName !== undefined || input.lastName !== undefined) {
		const updated = findPlayerWithEmail(playerId);
		if (updated) {
			await identity().updateName(playerId, `${updated.firstName} ${updated.lastName}`);
		}
	}
	recordAudit(actor, {
		action: 'player.admin_update',
		entityType: 'player',
		entityId: playerId,
		metadata: {
			fields: Object.keys(patch),
			...(cleared.length > 0 ? { positionRatingsCleared: cleared } : {})
		}
	});
	regenerateUpcomingGeneratedGames();

	return toAdmin(findPlayerWithEmail(playerId));
}

export async function setPlayerRole(
	actor: Actor,
	playerId: string,
	role: Role
): Promise<AdminPlayer> {
	requirePermission(actor, 'managePlayers');
	if (actor.kind === 'user' && actor.userId === playerId) {
		throw new AppError('FORBIDDEN', { key: 'admin.roleSelf' });
	}
	const row = findPlayerWithEmail(playerId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	await identity().setRole(playerId, role);
	recordAudit(actor, {
		action: 'player.role_update',
		entityType: 'player',
		entityId: playerId,
		metadata: { role }
	});
	return toAdmin(findPlayerWithEmail(playerId));
}

export async function deletePlayer(actor: Actor, playerId: string): Promise<void> {
	requirePermission(actor, 'managePlayers');
	if (actor.kind === 'user' && actor.userId === playerId) {
		throw new AppError('FORBIDDEN', { key: 'admin.deleteSelf' });
	}
	const row = findPlayerWithEmail(playerId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	const role = row.role && isRole(row.role) ? row.role : DEFAULT_ROLE;
	if (role === 'admin') {
		throw new AppError('FORBIDDEN', { key: 'admin.deleteAdmin' });
	}
	const now = clock.nowMs();
	deletePlayerAccount(
		playerId,
		todayInZone(branding.timezone, now),
		timeInZone(branding.timezone, now)
	);
	if (findPlayer(playerId)) {
		throw new AppError('INTERNAL', { key: 'admin.playerDeleteFailed' });
	}
	recordAudit(actor, {
		action: 'player.delete',
		entityType: 'player',
		entityId: playerId,
		metadata: { role }
	});
	regenerateUpcomingGeneratedGames();
}
