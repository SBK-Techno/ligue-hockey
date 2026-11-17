import { ABUSE_LIMITS } from '#config/abuse.ts';
import { requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { AppError } from '#lib/shared/errors.ts';
import { consumeAttempt } from './throttle.ts';

const MEMBER_ACTION_PREFIX = 'member-action:';

/**
 * Le seul limiteur des gestes de membre (présence, profil, discussion). Un
 * seau par acteur : les écritures rapides d'un même compte se suivent, sans
 * pénaliser les autres membres. La réservation est atomique pour qu'une rafale
 * parallèle ne dépasse jamais la limite.
 */
export function throttleMemberAction(actor: Actor): void {
	const user = requireUser(actor);
	const key = `${MEMBER_ACTION_PREFIX}${user.userId}`;
	const limit = ABUSE_LIMITS.memberAction;
	if (!consumeAttempt(key, limit.limit, limit.windowMs)) {
		throw new AppError('RATE_LIMITED');
	}
}
