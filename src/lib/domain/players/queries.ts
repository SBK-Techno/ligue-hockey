import { and, asc, eq, gt, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import {
	identityAllowedForPosition,
	isIdentityId,
	type IdentityId
} from '#config/identities.ts';
import type { Position } from '#config/positions.ts';
import { ADMIN_ROLE } from '#config/roles.ts';
import { positionRatingKeysToClear } from '#config/rating-attributes.ts';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { paymentPlans, payments } from '#lib/domain/finance/schema.ts';
import { gameAvailability, gameSlots, games } from '#lib/domain/games/schema.ts';
import { subRequests } from '#lib/domain/subs/schema.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { playerRatings, type PlayerRatingRow } from '#lib/domain/ratings/schema.ts';
import { firstFreeAvatarId } from './identity.ts';
import { players, type NewPlayerRow, type PlayerRow } from './schema.ts';

export type PlayerWithEmail = PlayerRow & {
	email: string;
	role: string | null;
};

export function findPlayer(playerId: string): PlayerRow | undefined {
	return db.select().from(players).where(eq(players.userId, playerId)).get();
}

export function findPlayerWithEmail(playerId: string): PlayerWithEmail | undefined {
	return db
		.select({
			userId: players.userId,
			firstName: players.firstName,
			lastName: players.lastName,
			position: players.position,
			age: players.age,
			jerseyNumber: players.jerseyNumber,
			avatarId: players.avatarId,
			isSubstitute: players.isSubstitute,
			active: players.active,
			createdAt: players.createdAt,
			updatedAt: players.updatedAt,
			email: user.email,
			role: user.role
		})
		.from(players)
		.innerJoin(user, eq(user.id, players.userId))
		.where(eq(players.userId, playerId))
		.get();
}

export function findPlayersByIds(playerIds: readonly string[]): PlayerRow[] {
	if (playerIds.length === 0) return [];
	return db
		.select()
		.from(players)
		.where(inArray(players.userId, [...playerIds]))
		.all();
}

export function listActivePlayers(): PlayerRow[] {
	return db
		.select()
		.from(players)
		.where(eq(players.active, true))
		.orderBy(asc(players.lastName), asc(players.firstName))
		.all();
}

export type PlayerAvatarAssignment = {
	userId: string;
	avatarId: string | null;
};

/** Every active player, including those whose avatar is still derived. */
export function listActiveAvatarAssignments(): PlayerAvatarAssignment[] {
	return db
		.select({ userId: players.userId, avatarId: players.avatarId })
		.from(players)
		.where(eq(players.active, true))
		.all();
}

export function listAllPlayersWithEmail(): PlayerWithEmail[] {
	return db
		.select({
			userId: players.userId,
			firstName: players.firstName,
			lastName: players.lastName,
			position: players.position,
			age: players.age,
			jerseyNumber: players.jerseyNumber,
			avatarId: players.avatarId,
			isSubstitute: players.isSubstitute,
			active: players.active,
			createdAt: players.createdAt,
			updatedAt: players.updatedAt,
			email: user.email,
			role: user.role
		})
		.from(players)
		.innerJoin(user, eq(user.id, players.userId))
		.orderBy(asc(players.active), asc(players.lastName), asc(players.firstName))
		.all();
}

export type InsertPlayerResult =
	| { status: 'inserted'; avatarId: IdentityId }
	| { status: 'no-identity' }
	| { status: 'avatar-taken' };

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ReadExecutor = Transaction | typeof db;

function activeAvatarIds(executor: ReadExecutor): string[] {
	return executor
		.select({ avatarId: players.avatarId })
		.from(players)
		.where(and(eq(players.active, true), isNotNull(players.avatarId)))
		.all()
		.map((row) => row.avatarId)
		.filter((avatarId): avatarId is string => avatarId !== null);
}

function isUniqueConstraint(error: unknown): boolean {
	const code = (error as { code?: string }).code;
	return (
		code === 'SQLITE_CONSTRAINT_UNIQUE' ||
		(error instanceof Error && error.message.includes('UNIQUE constraint failed'))
	);
}

/**
 * Choisit la première identité libre pour le poste et l'écrit dans la même
 * transaction. Le catalogue épuisé est une erreur explicite : une fiche active
 * ne porte jamais une identité nulle.
 */
export function insertPlayerWithNextAvatar(
	row: Omit<NewPlayerRow, 'avatarId'>,
	position: Position
): InsertPlayerResult {
	try {
		return db.transaction((tx) => {
			const avatarId = firstFreeAvatarId(activeAvatarIds(tx), position);
			if (!avatarId) return { status: 'no-identity' as const };
			tx.insert(players).values({ ...row, avatarId }).run();
			return { status: 'inserted' as const, avatarId };
		});
	} catch (error) {
		if (isUniqueConstraint(error)) return { status: 'avatar-taken' };
		throw error;
	}
}

export function hasFreeAvatarForPosition(position: Position): boolean {
	return firstFreeAvatarId(activeAvatarIds(db), position) !== null;
}

export function countActiveAdmins(): number {
	const row = db
		.select({ count: sql<number>`count(*)` })
		.from(players)
		.innerJoin(user, eq(user.id, players.userId))
		.where(and(eq(players.active, true), eq(user.role, ADMIN_ROLE)))
		.get();
	return row?.count ?? 0;
}

export type PlayerPatch = Partial<
	Pick<
		PlayerRow,
		| 'firstName'
		| 'lastName'
		| 'position'
		| 'age'
		| 'jerseyNumber'
		| 'avatarId'
		| 'isSubstitute'
		| 'active'
	>
>;

export type PlayerUpdateOptions = {
	deactivate?: {
		today: string;
		nowTime: string;
	};
};

export type PlayerUpdateResult =
	| { status: 'updated'; cleared: string[] }
	| { status: 'not-found' }
	| { status: 'identity-position' }
	| { status: 'avatar-taken' }
	| { status: 'no-identity' };

/**
 * Met à jour le joueur et, si son poste change, supprime dans la même
 * transaction les critères de position qui ne s'appliquent plus. Une identité
 * choisie est réservée dans cette même transaction : la lecture de
 * disponibilité et l'écriture ne peuvent pas être séparées par une autre
 * réservation. La désactivation retire aussi, atomiquement, les engagements
 * futurs du joueur.
 */
export function updatePlayer(
	playerId: string,
	patch: PlayerPatch,
	options: PlayerUpdateOptions = {}
): PlayerUpdateResult {
	try {
		return db.transaction((tx): PlayerUpdateResult => {
			const current = tx
				.select()
				.from(players)
				.where(eq(players.userId, playerId))
				.get();
			if (!current) return { status: 'not-found' };

			const next = { ...patch };
			const positionTouched =
				(next.position !== undefined && next.position !== current.position) ||
				(next.avatarId !== undefined && next.avatarId !== current.avatarId);
			const effectivePosition = next.position ?? current.position;
			const currentAvatar = next.avatarId !== undefined ? next.avatarId : current.avatarId;
			if (
				positionTouched &&
				currentAvatar !== null &&
				!identityAllowedForPosition(currentAvatar as IdentityId, effectivePosition)
			) {
				return { status: 'identity-position' };
			}

			// Une identité retirée du catalogue ou absente ne peut pas redevenir
			// active telle quelle : l'activation en réserve une libre.
			const validAvatar =
				currentAvatar !== null && isIdentityId(currentAvatar) ? currentAvatar : null;
			if (next.active === true && validAvatar === null) {
				const free = firstFreeAvatarId(activeAvatarIds(tx), effectivePosition);
				if (!free) return { status: 'no-identity' };
				next.avatarId = free;
			}

			const claimedAvatar =
				next.avatarId !== undefined
					? next.avatarId
					: next.active === true
						? validAvatar
						: null;
			if (claimedAvatar !== null) {
				const conflict = tx
					.select({ userId: players.userId })
					.from(players)
					.where(
						and(
							eq(players.active, true),
							eq(players.avatarId, claimedAvatar),
							ne(players.userId, playerId)
						)
					)
					.get();
				if (conflict) return { status: 'avatar-taken' };
			}

			let cleared: string[] = [];
			if (next.position !== undefined && current.position !== next.position) {
				const stored = tx
					.select({ attribute: playerRatings.attribute })
					.from(playerRatings)
					.where(eq(playerRatings.playerId, playerId))
					.all()
					.map((row) => row.attribute);
				cleared = positionRatingKeysToClear(next.position, stored);
				if (cleared.length > 0) {
					tx.delete(playerRatings)
						.where(
							and(
								eq(playerRatings.playerId, playerId),
								inArray(playerRatings.attribute, cleared as PlayerRatingRow['attribute'][])
							)
						)
						.run();
				}
			}

			if (Object.keys(next).length > 0) {
				tx.update(players)
					.set({ ...next, updatedAt: clock.nowMs() })
					.where(eq(players.userId, playerId))
					.run();
			}

			if (options.deactivate) {
				clearFutureCommitments(tx, playerId, options.deactivate);
			}

			return { status: 'updated', cleared };
		});
	} catch (error) {
		if (isUniqueConstraint(error)) return { status: 'avatar-taken' };
		throw error;
	}
}

/**
 * Retire le joueur des matchs qui n'ont pas commencé. Les faits historiques
 * (matchs passés, terminés ou annulés) restent intacts.
 */
function clearFutureCommitments(
	tx: Transaction,
	playerId: string,
	window: NonNullable<PlayerUpdateOptions['deactivate']>
): void {
	const now = clock.nowMs();
	const futureIds = tx
		.select({ id: games.id })
		.from(games)
		.where(
			and(
				eq(games.status, 'scheduled'),
				or(
					gt(games.gameDate, window.today),
					and(eq(games.gameDate, window.today), gt(games.startTime, window.nowTime))
				)
			)
		)
		.all()
		.map((row) => row.id);
	if (futureIds.length === 0) return;

	tx.update(gameSlots)
		.set({ assignedPlayerId: null, assignmentKind: null, updatedAt: now })
		.where(
			and(
				eq(gameSlots.assignedPlayerId, playerId),
				inArray(gameSlots.gameId, futureIds)
			)
		)
		.run();
	tx.delete(gameAvailability)
		.where(
			and(
				eq(gameAvailability.playerId, playerId),
				inArray(gameAvailability.gameId, futureIds)
			)
		)
		.run();
	tx.update(subRequests)
		.set({ status: 'open', filledByPlayerId: null, filledAt: null })
		.where(
			and(
				eq(subRequests.filledByPlayerId, playerId),
				inArray(subRequests.gameId, futureIds)
			)
		)
		.run();
}

/**
 * Deletes a player account and every row that would otherwise block the
 * deletion. Finance and assignment rows use restrictive foreign keys, so they
 * are cleared here in the same transaction as the user row. Game slots keep
 * their history with an empty assignment; sub requests filled by the deleted
 * player reopen so the league can fill them again.
 */
export function deletePlayerAccount(playerId: string, today: string, nowTime: string): void {
	const now = clock.nowMs();
	db.transaction((tx) => {
		tx.delete(paymentPlans).where(eq(paymentPlans.playerId, playerId)).run();
		tx.delete(payments).where(eq(payments.playerId, playerId)).run();
		tx.update(gameSlots)
			.set({ assignedPlayerId: null, assignmentKind: null, updatedAt: now })
			.where(eq(gameSlots.assignedPlayerId, playerId))
			.run();
		tx.delete(subRequests).where(eq(subRequests.requestedByPlayerId, playerId)).run();

		// Une place reprise sur un match à venir redevient disponible. Sur un
		// match passé ou annulé, elle est fermée pour conserver l'historique.
		const reopenable = tx
			.select({ id: games.id })
			.from(games)
			.where(
				and(
					eq(games.status, 'scheduled'),
					or(
						gt(games.gameDate, today),
						and(eq(games.gameDate, today), gt(games.startTime, nowTime))
					)
				)
			)
			.all()
			.map((row) => row.id);
		if (reopenable.length > 0) {
			tx.update(subRequests)
				.set({ status: 'open', filledByPlayerId: null, filledAt: null })
				.where(
					and(
						eq(subRequests.filledByPlayerId, playerId),
						inArray(subRequests.gameId, reopenable)
					)
				)
				.run();
		}
		tx.update(subRequests)
			.set({
				status: 'cancelled',
				filledByPlayerId: null,
				filledAt: null,
				cancelledAt: now
			})
			.where(eq(subRequests.filledByPlayerId, playerId))
			.run();
		tx.delete(user).where(eq(user.id, playerId)).run();
	});
}
