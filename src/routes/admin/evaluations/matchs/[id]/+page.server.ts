import type { Actions, ServerLoad } from '@sveltejs/kit';
import { gameRatingAttributes } from '#config/rating-attributes.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import {
	getGameAssessment,
	saveGameAssessment
} from '#lib/domain/ratings/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { actionError, loadError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { clock } from '#lib/shared/time/clock.ts';

export const load: ServerLoad = ({ locals, params }) => {
	try {
		requirePermission(locals.actor, 'editRatings');
		return { assessment: getGameAssessment(locals.actor, params.id!) };
	} catch (cause) {
		return loadError(cause);
	}
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		let playerId = '';
		try {
			requirePermission(locals.actor, 'editRatings');
			const form = await request.formData();
			playerId = String(form.get('playerId') ?? '');
			const assessment = getGameAssessment(locals.actor, params.id!);
			const player = assessment.players.find((entry) => entry.playerId === playerId);
			if (!player) {
				throw new AppError('VALIDATION', { key: 'rating.playerNotInGame' });
			}
			const input =
				form.get('clear') === '1'
					? {}
					: Object.fromEntries(
							gameRatingAttributes(player.position).map((attribute) => [
								attribute.key,
								form.get(attribute.key)
							])
						);
			const result = saveGameAssessment(
				locals.actor,
				params.id!,
				playerId,
				input
			);
			return {
				ok: true,
				message: t('rating.saved'),
				playerId,
				revision: clock.nowMs(),
				assessment: result
			};
		} catch (cause) {
			return actionError(cause, { playerId });
		}
	}
};
