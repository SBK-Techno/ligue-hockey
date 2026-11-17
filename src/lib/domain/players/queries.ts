import { and, asc, eq, gt, inArray, or } from 'drizzle-orm';
import { positionRatingKeysToClear } from '#config/rating-attributes.ts';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { paymentPlans, payments } from '#lib/domain/finance/schema.ts';
import { gameSlots, games } from '#lib/domain/games/schema.ts';
import { subRequests } from '#lib/domain/subs/schema.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { playerRatings, type PlayerRatingRow } from '#lib/domain/ratings/schema.ts';
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

export function insertPlayer(row: NewPlayerRow): void {
	db.insert(players).values(row).run();
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

/**
 * Met à jour le joueur et, si son poste change, supprime dans la même
 * transaction les critères de position qui ne s'appliquent plus. Retourne les
 * critères supprimés pour que le service puisse les auditer.
 */
export function updatePlayer(playerId: string, patch: PlayerPatch): string[] {
	if (Object.keys(patch).length === 0) return [];
	return db.transaction((tx) => {
		let cleared: string[] = [];
		if (patch.position !== undefined) {
			const current = tx
				.select({ position: players.position })
				.from(players)
				.where(eq(players.userId, playerId))
				.get();
			if (current && current.position !== patch.position) {
				const stored = tx
					.select({ attribute: playerRatings.attribute })
					.from(playerRatings)
					.where(eq(playerRatings.playerId, playerId))
					.all()
					.map((row) => row.attribute);
				cleared = positionRatingKeysToClear(patch.position, stored);
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
		}
		tx.update(players)
			.set({ ...patch, updatedAt: clock.nowMs() })
			.where(eq(players.userId, playerId))
			.run();
		return cleared;
	});
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
