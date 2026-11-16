import type { ServerLoad } from '@sveltejs/kit';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import {
	evaluationOverviews,
	playedGamesForAssessment
} from '#lib/domain/ratings/service.ts';
import { loadError } from '#lib/server/action.ts';

export const load: ServerLoad = ({ locals }) => {
	try {
		requirePermission(locals.actor, 'editRatings');
		return {
			overviews: evaluationOverviews(locals.actor),
			games: playedGamesForAssessment(locals.actor)
		};
	} catch (cause) {
		return loadError(cause);
	}
};
