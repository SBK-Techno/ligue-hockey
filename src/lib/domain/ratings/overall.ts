import {
	RATING_ATTRIBUTES,
	overallRating,
	type RatingAttribute,
	type RatingValues
} from '#config/rating-attributes.ts';
import { listRatingsForPlayers } from './queries.ts';

/**
 * Calculs de note partagés. Ce module ne dépend d'aucun service pour rester
 * utilisable par le générateur d'équipes et le recalcul automatique.
 */
export function overallsForPlayers(
	playerIds: readonly string[]
): Map<string, number> {
	const grouped = new Map<string, RatingValues>();
	for (const row of listRatingsForPlayers(playerIds)) {
		const values = grouped.get(row.playerId) ?? {};
		values[row.attribute as RatingAttribute] = row.value;
		grouped.set(row.playerId, values);
	}

	const result = new Map<string, number>();
	for (const [playerId, values] of grouped) {
		if (RATING_ATTRIBUTES.every((attribute) => values[attribute.key] !== undefined)) {
			result.set(playerId, overallRating(values));
		}
	}
	return result;
}
