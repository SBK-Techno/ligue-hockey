import { inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	RATING_ATTRIBUTE_KEYS,
	type RatingAttribute
} from '#config/rating-attributes.ts';
import { playerRatings, type PlayerRatingRow } from './schema.ts';

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
	values: Record<RatingAttribute, number>,
	updatedAt: number,
	updatedBy: string | null
): void {
	db.transaction((tx) => {
		for (const attribute of RATING_ATTRIBUTE_KEYS) {
			tx.insert(playerRatings)
				.values({
					playerId,
					attribute,
					value: values[attribute],
					updatedAt,
					updatedBy
				})
				.onConflictDoUpdate({
					target: [playerRatings.playerId, playerRatings.attribute],
					set: {
						value: values[attribute],
						updatedAt,
						updatedBy
					}
				})
				.run();
		}
	});
}
