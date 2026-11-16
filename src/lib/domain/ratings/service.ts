import {
	RATING_ATTRIBUTES,
	overallRating,
	type RatingValues
} from '#config/rating-attributes.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { regenerateUpcomingGeneratedGames } from '#lib/domain/games/upcoming.ts';
import { getPlayer } from '#lib/domain/players/service.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { listRatings, upsertRatings } from './queries.ts';
import type { RatingsInput } from './validators.ts';

export type RatingsView = {
	playerId: string;
	values: RatingValues;
	overall: number | null;
	updatedAt: number | null;
};

function overallOf(values: RatingValues): number | null {
	const complete = RATING_ATTRIBUTES.every(
		(attribute) => values[attribute.key] !== undefined
	);
	return complete ? overallRating(values) : null;
}

export function getRatings(actor: Actor, playerId: string): RatingsView {
	requirePermission(actor, 'editRatings');
	getPlayer(actor, playerId);

	const rows = listRatings(playerId);
	const values: RatingValues = {};
	let updatedAt: number | null = null;
	for (const row of rows) {
		values[row.attribute] = row.value;
		updatedAt = Math.max(updatedAt ?? 0, row.updatedAt);
	}

	return {
		playerId,
		values,
		overall: overallOf(values),
		updatedAt
	};
}

export function setRatings(
	actor: Actor,
	playerId: string,
	input: RatingsInput
): RatingsView {
	const user = requirePermission(actor, 'editRatings');
	getPlayer(actor, playerId);

	upsertRatings(playerId, input, clock.nowMs(), user.userId);
	recordAudit(actor, {
		action: 'ratings.update',
		entityType: 'player',
		entityId: playerId
	});
	regenerateUpcomingGeneratedGames();

	return getRatings(actor, playerId);
}

