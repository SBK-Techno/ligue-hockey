import type { Position } from '#config/positions.ts';
import { DEFAULT_ROLE, isRole, type Role } from '#config/roles.ts';
import { requirePermission, requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { identity } from '#lib/domain/auth/identity.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { newToken } from '#lib/shared/ids/id.ts';
import { logger } from '#lib/shared/logging/logger.ts';
import { clock } from '#lib/shared/time/clock.ts';
import {
	findPlayer,
	findPlayerWithEmail,
	findPlayersByIds,
	insertPlayer,
	listActivePlayers,
	listAllPlayersWithEmail,
	updatePlayer
} from './queries.ts';
import type { PlayerRow } from './schema.ts';
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

function fullName(row: Pick<PlayerRow, 'firstName' | 'lastName'>): string {
	return `${row.firstName} ${row.lastName}`;
}

function isDuplicateEmail(error: unknown): boolean {
	const code = (error as { body?: { code?: string } }).body?.code;
	return code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' || code === 'USER_ALREADY_EXISTS';
}

function toPublic(row: PlayerRow): PublicPlayer {
	return {
		userId: row.userId,
		firstName: row.firstName,
		lastName: row.lastName,
		fullName: fullName(row),
		position: row.position,
		isSubstitute: row.isSubstitute,
		active: row.active
	};
}

function requireVisible(actor: Actor, playerId: string) {
	const user = requireUser(actor);
	const row = findPlayerWithEmail(playerId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	if (user.role === 'admin' || user.userId === playerId) {
		return { row, isAdmin: user.role === 'admin' };
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

export function isSubstitutePlayer(actor: Actor): boolean {
	const user = requireUser(actor);
	return findPlayer(user.userId)?.isSubstitute ?? false;
}

export function listRoster(actor: Actor): PublicPlayer[] {
	requireUser(actor);
	return listActivePlayers().map(toPublic);
}

export type PlayerCandidate = PublicPlayer & {
	age: number;
};

export function generationCandidates(): PlayerCandidate[] {
	return listActivePlayers().map((row) => ({
		...toPublic(row),
		age: row.age
	}));
}

export function playersByIds(playerIds: readonly string[]): PublicPlayer[] {
	return findPlayersByIds(playerIds).map(toPublic);
}

export function listAdminPlayers(actor: Actor): AdminPlayer[] {
	requirePermission(actor, 'managePlayers');
	return listAllPlayersWithEmail().map(toAdmin);
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

export function getPlayer(actor: Actor, playerId: string): SelfProfile | PublicPlayer {
	const { row, isAdmin } = requireVisible(actor, playerId);
	if (isAdmin || (actor.kind === 'user' && actor.userId === playerId)) {
		return { ...toPublic(row), email: row.email, age: row.age };
	}
	return toPublic(row);
}

export async function invitePlayer(
	actor: Actor,
	input: InvitePlayerInput
): Promise<{ userId: string; inviteSent: boolean }> {
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

	let inviteSent = true;
	try {
		await identity().requestPasswordReset(input.email);
	} catch (error) {
		inviteSent = false;
		logger.error('players.invite_email_failed', {
			userId: created.id,
			error
		});
	}

	recordAudit(actor, {
		action: 'player.invite',
		entityType: 'player',
		entityId: created.id,
		metadata: { position: input.position, inviteSent }
	});

	return { userId: created.id, inviteSent };
}

export async function resendInvite(actor: Actor, playerId: string): Promise<void> {
	requirePermission(actor, 'managePlayers');
	const row = findPlayerWithEmail(playerId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}

	try {
		await identity().requestPasswordReset(row.email);
	} catch (cause) {
		throw new AppError('INTERNAL', { key: 'admin.inviteFailed', cause });
	}

	recordAudit(actor, {
		action: 'player.invite_resent',
		entityType: 'player',
		entityId: playerId
	});
}

export function updateOwnProfile(
	actor: Actor,
	input: UpdateOwnProfileInput
): SelfProfile {
	const user = requireUser(actor);
	const row = findPlayer(user.userId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}

	updatePlayer(user.userId, {
		firstName: input.firstName,
		lastName: input.lastName,
		age: input.age
	});
	recordAudit(actor, {
		action: 'player.self_update',
		entityType: 'player',
		entityId: user.userId
	});
	return getOwnProfile(actor);
}

export function adminUpdatePlayer(
	actor: Actor,
	playerId: string,
	input: AdminUpdatePlayerInput
): AdminPlayer {
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
	if (input.isSubstitute !== undefined) patch.isSubstitute = input.isSubstitute;
	if (input.active !== undefined) patch.active = input.active;

	updatePlayer(playerId, patch);
	recordAudit(actor, {
		action: 'player.admin_update',
		entityType: 'player',
		entityId: playerId,
		metadata: { fields: Object.keys(patch) }
	});

	return toAdmin(findPlayerWithEmail(playerId));
}
