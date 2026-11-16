import type { Actions, ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { POSITION_KEYS } from '#config/positions.ts';
import { isSubstitutePlayer } from '#lib/domain/players/service.ts';
import {
	claimSubstitute,
	listOpenRequests,
	listSubstitutePool
} from '#lib/domain/roster/service.ts';
import { getMySubProfile, saveMySubProfile } from '#lib/domain/subs/service.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const profileSchema = z.object({
	positions: z.preprocess(
		(value) => (Array.isArray(value) ? value : [value]),
		z.array(z.enum(POSITION_KEYS)).min(1)
	)
});

const claimSchema = z.object({
	gameId: z.string().min(1),
	requestId: z.string().min(1)
});

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') {
		return { requests: [], pool: [], positions: [], isSubstitute: false };
	}
	return {
		requests: listOpenRequests(actor),
		pool: listSubstitutePool(actor),
		positions: getMySubProfile(actor).positions,
		isSubstitute: isSubstitutePlayer(actor)
	};
};

export const actions: Actions = {
	saveProfile: async ({ request, locals }) => {
		try {
			const parsed = parseForm(profileSchema, await request.formData());
			saveMySubProfile(locals.actor, { positions: parsed.positions });
			return { message: t('subs.profileSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	claim: async ({ request, locals }) => {
		try {
			const parsed = parseForm(claimSchema, await request.formData());
			const result = claimSubstitute(locals.actor, parsed.gameId, parsed.requestId);
			return {
				message: result.warning ? t(result.warning) : t('subs.claimed')
			};
		} catch (cause) {
			return actionError(cause);
		}
	}
};
