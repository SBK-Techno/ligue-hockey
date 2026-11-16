import { and, asc, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { games } from '#lib/domain/games/schema.ts';
import { playerRatings, gamePlayerRatings, type PlayerRatingRow } from './schema.ts';

export function listRatings(playerId: string): PlayerRatingRow[] {
	return db
		.select()
		.from(playerRatings)
		.where(inArray(playerRatings.playerId, [playerId]))
		.all();
}

export function listRatingsForPlayers(
	playerIds: readonly string[]
): PlayerRatingRow[] {
	if (playerIds.length === 0) return [];
	return db
		.select()
		.from(playerRatings)
		.where(inArray(playerRatings.playerId, [...playerIds]))
		.all();
}

export function upsertRatings(
	playerId: string,
	values: Record<string, number>,
	updatedAt: number,
	updatedBy: string | null
): void {
	const entries = Object.entries(values);
	db.transaction((tx) => {
		for (const [attribute, value] of entries) {
			tx.insert(playerRatings)
				.values({
					playerId,
					attribute: attribute as PlayerRatingRow['attribute'],
					value,
					updatedAt,
					updatedBy
				})
				.onConflictDoUpdate({
					target: [playerRatings.playerId, playerRatings.attribute],
					set: { value, updatedAt, updatedBy }
				})
				.run();
		}
	});
}

export type GameRatingRow = {
	gameId: string;
	playerId: string;
	attribute: string;
	value: number;
	updatedAt: number;
};

export function listGameRatings(gameId: string): GameRatingRow[] {
	return db
		.select({
			gameId: gamePlayerRatings.gameId,
			playerId: gamePlayerRatings.playerId,
			attribute: gamePlayerRatings.attribute,
			value: gamePlayerRatings.value,
			updatedAt: gamePlayerRatings.updatedAt
		})
		.from(gamePlayerRatings)
		.where(eq(gamePlayerRatings.gameId, gameId))
		.all();
}

/**
 * Remplace l'évaluation d'un joueur et supprime, dans la même transaction,
 * les notes des joueurs qui ne font plus partie de l'alignement habillé.
 */
export function replaceGameRatings(
	gameId: string,
	playerId: string,
	values: Record<string, number>,
	updatedAt: number,
	updatedBy: string | null,
	dressedPlayerIds: readonly string[]
): void {
	db.transaction((tx) => {
		if (dressedPlayerIds.length === 0) {
			tx.delete(gamePlayerRatings)
				.where(eq(gamePlayerRatings.gameId, gameId))
				.run();
		} else {
			tx.delete(gamePlayerRatings)
				.where(
					and(
						eq(gamePlayerRatings.gameId, gameId),
						notInArray(gamePlayerRatings.playerId, [...dressedPlayerIds])
					)
				)
				.run();
		}
		tx.delete(gamePlayerRatings)
			.where(
				and(
					eq(gamePlayerRatings.gameId, gameId),
					eq(gamePlayerRatings.playerId, playerId)
				)
			)
			.run();
		for (const [attribute, value] of Object.entries(values)) {
			tx.insert(gamePlayerRatings)
				.values({
					gameId,
					playerId,
					attribute: attribute as GameRatingRow['attribute'] as never,
					value,
					updatedAt,
					updatedBy
				})
				.run();
		}
	});
}

export type PlayerGameRatingHistoryRow = {
	gameId: string;
	gameDate: string;
	startTime: string;
	attribute: string;
	value: number;
};

export function listPlayerGameRatings(
	playerId: string
): PlayerGameRatingHistoryRow[] {
	return db
		.select({
			gameId: gamePlayerRatings.gameId,
			gameDate: games.gameDate,
			startTime: games.startTime,
			attribute: gamePlayerRatings.attribute,
			value: gamePlayerRatings.value
		})
		.from(gamePlayerRatings)
		.innerJoin(games, eq(games.id, gamePlayerRatings.gameId))
		.where(eq(gamePlayerRatings.playerId, playerId))
		.orderBy(desc(games.gameDate), desc(games.startTime), desc(games.id), asc(gamePlayerRatings.attribute))
		.all();
}
