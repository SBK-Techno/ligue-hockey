import { ABUSE_LIMITS } from '#config/abuse.ts';
import { legendForIdentity } from '#config/identities.ts';
import type { Legend } from '#config/legends.ts';
import { can } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import {
	seasonStatsFor,
	type SeasonStats
} from '#lib/domain/gamesheet/season-stats.ts';
import { getRatings, type RatingsView } from '#lib/domain/ratings/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { consumeAttempt } from '#lib/server/security/throttle.ts';
import { getPlayer, type PublicPlayer } from './service.ts';

/**
 * The compact player sheet shown by the global peek.
 *
 * It is public to members: identity, position, jersey and season totals. The
 * skills block is reserved to the ratings capability, exactly like every other
 * ratings surface; a player actor never receives it. The view deliberately
 * drops email and age even when the caller could see them, because the peek is
 * a shared card, not an account screen.
 */
export type PlayerPeekView = {
	player: PublicPlayer;
	legend: Legend | null;
	stats: SeasonStats;
	ratings: RatingsView | null;
};

/**
 * La fiche complète n'est jamais mise en cache : une réponse qui contient les
 * notes ne doit pas resservir après une perte de capacité. Les autres fiches
 * restent privées et courtes.
 */
export function peekCacheControl(actor: Actor): string {
	return actor.kind === 'user' && can(actor, 'editRatings')
		? 'no-store'
		: 'private, max-age=15';
}

/**
 * Le seul limiteur des fiches de joueur. Il vit dans le service, pas dans la
 * route, pour que tout appelant passe par le même seau.
 */
export function assertPeekAllowed(actor: Actor): void {
	const key = `peek:${actor.kind === 'user' ? actor.userId : 'anonymous'}`;
	if (!consumeAttempt(key, ABUSE_LIMITS.peek.limit, ABUSE_LIMITS.peek.windowMs)) {
		throw new AppError('RATE_LIMITED');
	}
}

export function getPlayerPeek(actor: Actor, playerId: string): PlayerPeekView {
	assertPeekAllowed(actor);
	const full = getPlayer(actor, playerId);
	const player: PublicPlayer = {
		userId: full.userId,
		firstName: full.firstName,
		lastName: full.lastName,
		fullName: full.fullName,
		position: full.position,
		jerseyNumber: full.jerseyNumber,
		avatarId: full.avatarId,
		isSubstitute: full.isSubstitute,
		active: full.active
	};
	const ratings =
		actor.kind === 'user' && can(actor, 'editRatings')
			? getRatings(actor, playerId)
			: null;
	return {
		player,
		legend: legendForIdentity(player.avatarId),
		stats: seasonStatsFor(playerId),
		ratings
	};
}
