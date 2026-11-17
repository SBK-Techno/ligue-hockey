import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { db, type DbExecutor } from '#lib/server/db/index.ts';
import { games, gameSlots } from '#lib/domain/games/schema.ts';
import { players } from '#lib/domain/players/schema.ts';
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

/**
 * Remplace la fiche de saison d'un joueur : les clés fournies sont écrites,
 * les clés gérées absentes sont supprimées, le tout dans une transaction.
 */
export function replaceSeasonRatings(
	playerId: string,
	values: Record<string, number>,
	managedAttributes: readonly string[],
	updatedAt: number,
	updatedBy: string | null
): void {
	db.transaction((tx) => {
		const provided = new Set(Object.keys(values));
		const missing = managedAttributes.filter((attribute) => !provided.has(attribute));
		if (missing.length > 0) {
			tx.delete(playerRatings)
				.where(
					and(
						eq(playerRatings.playerId, playerId),
						inArray(playerRatings.attribute, missing as PlayerRatingRow['attribute'][])
					)
				)
				.run();
		}
		for (const [attribute, value] of Object.entries(values)) {
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

export type AssessmentGameRow = {
	gameId: string;
	gameDate: string;
	startTime: string;
	location: string;
	status: 'scheduled' | 'cancelled' | 'completed';
	generated: boolean;
	team: 'white' | 'black';
	position: 'forward' | 'defense' | 'goalie';
	slotIndex: number;
	playerId: string;
	firstName: string;
	lastName: string;
	jerseyNumber: number | null;
};

/**
 * Les matchs et leur alignement habillé, en une lecture. La feuille
 * d'évaluation lit cette projection groupée au lieu d'une fiche par match.
 */
export function listAssessmentGames(
	gameIds: readonly string[]
): AssessmentGameRow[] {
	if (gameIds.length === 0) return [];
	return db
		.select({
			gameId: games.id,
			gameDate: games.gameDate,
			startTime: games.startTime,
			location: games.location,
			status: games.status,
			generatedAt: games.generatedAt,
			generationJson: games.generationJson,
			team: gameSlots.team,
			position: gameSlots.position,
			slotIndex: gameSlots.slotIndex,
			playerId: players.userId,
			firstName: players.firstName,
			lastName: players.lastName,
			jerseyNumber: players.jerseyNumber
		})
		.from(games)
		.innerJoin(gameSlots, eq(gameSlots.gameId, games.id))
		.innerJoin(players, eq(players.userId, gameSlots.assignedPlayerId))
		.where(
			and(
				inArray(games.id, [...gameIds]),
				isNotNull(gameSlots.assignedPlayerId)
			)
		)
		.orderBy(
			asc(games.gameDate),
			asc(games.startTime),
			asc(gameSlots.team),
			asc(gameSlots.position),
			asc(gameSlots.slotIndex)
		)
		.all()
		.map((row) => ({
			gameId: row.gameId,
			gameDate: row.gameDate,
			startTime: row.startTime,
			location: row.location,
			status: row.status,
			generated: row.generationJson !== null && row.generatedAt !== null,
			team: row.team,
			position: row.position,
			slotIndex: row.slotIndex,
			playerId: row.playerId,
			firstName: row.firstName,
			lastName: row.lastName,
			jerseyNumber: row.jerseyNumber
		}));
}

/** Toutes les notes de match des matchs demandés, en une lecture. */
export function listGameRatingsForGames(
	gameIds: readonly string[]
): GameRatingRow[] {
	if (gameIds.length === 0) return [];
	return db
		.select({
			gameId: gamePlayerRatings.gameId,
			playerId: gamePlayerRatings.playerId,
			attribute: gamePlayerRatings.attribute,
			value: gamePlayerRatings.value,
			updatedAt: gamePlayerRatings.updatedAt
		})
		.from(gamePlayerRatings)
		.where(inArray(gamePlayerRatings.gameId, [...gameIds]))
		.all();
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
 * Remplace l'évaluation d'un joueur. Seules ses propres lignes bougent : le
 * retrait d'un joueur de l'alignement est la responsabilité de l'écrivain
 * d'alignement, qui purge et audite dans sa transaction.
 */
export function replaceGameRatings(
	gameId: string,
	playerId: string,
	values: Record<string, number>,
	updatedAt: number,
	updatedBy: string | null
): void {
	db.transaction((tx) => {
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

/** Joueurs qui ont au moins une note de match enregistrée pour ce match. */
export function listGameRatingPlayerIds(gameId: string): string[] {
	return [
		...new Set(
			db
				.select({ playerId: gamePlayerRatings.playerId })
				.from(gamePlayerRatings)
				.where(eq(gamePlayerRatings.gameId, gameId))
				.all()
				.map((row) => row.playerId)
		)
	];
}

/**
 * Supprime les notes des joueurs retirés de l'alignement. L'écrivain
 * d'alignement fournit sa transaction pour que la purge et les places
 * réussissent ou échouent ensemble.
 */
export function deleteGameRatingsForPlayers(
	gameId: string,
	playerIds: readonly string[],
	executor: DbExecutor = db
): number {
	if (playerIds.length === 0) return 0;
	return executor
		.delete(gamePlayerRatings)
		.where(
			and(
				eq(gamePlayerRatings.gameId, gameId),
				inArray(gamePlayerRatings.playerId, [...playerIds])
			)
		)
		.run().changes;
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
		.innerJoin(
			gameSlots,
			and(
				eq(gameSlots.gameId, gamePlayerRatings.gameId),
				eq(gameSlots.assignedPlayerId, gamePlayerRatings.playerId)
			)
		)
		.where(eq(gamePlayerRatings.playerId, playerId))
		.orderBy(desc(games.gameDate), desc(games.startTime), desc(games.id), asc(gamePlayerRatings.attribute))
		.all();
}
