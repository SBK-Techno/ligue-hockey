import type { Actions, ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { PLAYER_LIMITS } from '#config/players.ts';
import { POSITION_KEYS } from '#config/positions.ts';
import { getMyBalance } from '#lib/domain/finance/service.ts';
import {
	getNotificationPreferences,
	updateNotificationPreferences
} from '#lib/domain/notifications/service.ts';
import {
	getOwnProfile,
	isSubstitutePlayer,
	updateOwnProfile
} from '#lib/domain/players/service.ts';
import { getMySubProfile, saveMySubProfile } from '#lib/domain/subs/service.ts';
import { actionError } from '#lib/server/action.ts';
import { publicEnv } from '#lib/shared/config/public-env.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const profileSchema = z.object({
	firstName: z.string().trim().min(1).max(PLAYER_LIMITS.nameMax),
	lastName: z.string().trim().min(1).max(PLAYER_LIMITS.nameMax),
	age: z.coerce
		.number()
		.int()
		.min(PLAYER_LIMITS.ageMin)
		.max(PLAYER_LIMITS.ageMax)
});

const positionsSchema = z.object({
	positions: z.preprocess(
		(value) => (Array.isArray(value) ? value : [value]),
		z.array(z.enum(POSITION_KEYS)).min(1)
	)
});

const notificationSchema = z.object({
	emailEnabled: z.preprocess((value) => value === 'on', z.boolean()),
	pushEnabled: z.preprocess((value) => value === 'on', z.boolean())
});

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') {
		return {
			profile: null,
			positions: [],
			notifications: { emailEnabled: true, pushEnabled: true },
			isSubstitute: false,
			balance: null,
			vapidPublicKey: publicEnv.vapidPublicKey
		};
	}

	return {
		profile: getOwnProfile(actor),
		positions: getMySubProfile(actor).positions,
		notifications: getNotificationPreferences(actor),
		isSubstitute: isSubstitutePlayer(actor),
		balance: getMyBalance(actor),
		vapidPublicKey: publicEnv.vapidPublicKey
	};
};

export const actions: Actions = {
	profile: async ({ request, locals }) => {
		try {
			const parsed = parseForm(profileSchema, await request.formData());
			updateOwnProfile(locals.actor, parsed);
			return { message: t('profile.saved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	positions: async ({ request, locals }) => {
		try {
			const parsed = parseForm(positionsSchema, await request.formData());
			saveMySubProfile(locals.actor, { positions: parsed.positions });
			return { message: t('subs.profileSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	notifications: async ({ request, locals }) => {
		try {
			const parsed = parseForm(notificationSchema, await request.formData());
			updateNotificationPreferences(locals.actor, parsed);
			return { message: t('profile.saved') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
