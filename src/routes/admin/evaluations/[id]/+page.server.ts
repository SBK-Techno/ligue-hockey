import type { Actions, ServerLoad } from '@sveltejs/kit';
import { positionRatingAttributes } from '#config/rating-attributes.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import { getAdminPlayer } from '#lib/domain/players/service.ts';
import { getRatings, setRatings } from '#lib/domain/ratings/service.ts';
import { actionError, loadError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { formToObject } from '#lib/shared/validation.ts';

export const load: ServerLoad = ({ locals, params }) => {
	try {
		requirePermission(locals.actor, 'editRatings');
		const player = getAdminPlayer(locals.actor, params.id!);
		return {
			player,
			ratings: getRatings(locals.actor, params.id!),
			attributes: positionRatingAttributes(player.position)
		};
	} catch (cause) {
		return loadError(cause);
	}
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		try {
			const player = getAdminPlayer(locals.actor, params.id!);
			const form = formToObject(await request.formData());
			const positionInput = Object.fromEntries(
				positionRatingAttributes(player.position).map((attribute) => [
					attribute.key,
					form[attribute.key]
				])
			);
			const ratings = setRatings(
				locals.actor,
				params.id!,
				form as never,
				positionInput
			);
			return { ok: true, message: t('rating.saved'), ratings };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
