import { fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { getMyBalance } from '#lib/domain/finance/service.ts';
import {
	getNotificationPreferences,
	updateNotificationPreferences
} from '#lib/domain/notifications/service.ts';
import { notificationPreferencesSchema } from '#lib/domain/notifications/validators.ts';
import {
	getOwnProfile,
	isSubstitutePlayer,
	updateOwnProfile
} from '#lib/domain/players/service.ts';
import { updateOwnProfileSchema } from '#lib/domain/players/validators.ts';
import { getMySubProfile, saveMySubProfile } from '#lib/domain/subs/service.ts';
import { subProfileInputSchema } from '#lib/domain/subs/validators.ts';
import { auth } from '#lib/server/auth.ts';
import { actionError } from '#lib/server/action.ts';
import {
	clearAttempts,
	recordAttempt,
	tooManyAttempts
} from '#lib/server/security/throttle.ts';
import { env } from '#lib/shared/config/env.ts';
import { publicEnv } from '#lib/shared/config/public-env.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const passwordSchema = z.object({
	currentPassword: z.string().min(1).max(128),
	newPassword: z.string().min(publicEnv.passwordMinLength).max(128),
	confirm: z.string().min(1).max(128)
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
			vapidPublicKey: publicEnv.vapidPublicKey,
			minLength: publicEnv.passwordMinLength
		};
	}

	return {
		profile: getOwnProfile(actor),
		positions: getMySubProfile(actor).positions,
		notifications: getNotificationPreferences(actor),
		isSubstitute: isSubstitutePlayer(actor),
		balance: getMyBalance(actor),
		vapidPublicKey: publicEnv.vapidPublicKey,
		minLength: publicEnv.passwordMinLength
	};
};

export const actions: Actions = {
	profile: async ({ request, locals }) => {
		try {
			const parsed = parseForm(updateOwnProfileSchema, await request.formData());
			updateOwnProfile(locals.actor, parsed);
			return { ok: true, message: t('profile.saved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	positions: async ({ request, locals }) => {
		try {
			const parsed = parseForm(subProfileInputSchema, await request.formData());
			saveMySubProfile(locals.actor, parsed);
			return { ok: true, message: t('subs.profileSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	notifications: async ({ request, locals }) => {
		try {
			const parsed = parseForm(notificationPreferencesSchema, await request.formData());
			updateNotificationPreferences(locals.actor, parsed);
			return { ok: true, message: t('profile.saved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	password: async ({ request, locals }) => {
		try {
			if (locals.actor.kind !== 'user') {
				return fail(401, { ok: false, message: t('error.sessionRequired') });
			}
			const parsed = parseForm(passwordSchema, await request.formData());
			if (parsed.newPassword !== parsed.confirm) {
				return fail(400, { ok: false, message: t('invite.mismatch') });
			}
			const key = `password:${locals.actor.userId}`;
			if (tooManyAttempts(key, env.security.passwordChangesPerHour)) {
				return fail(429, { ok: false, message: t('auth.throttled') });
			}
			try {
				await auth.api.changePassword({
					body: {
						currentPassword: parsed.currentPassword,
						newPassword: parsed.newPassword,
						revokeOtherSessions: true
					},
					headers: request.headers
				});
				clearAttempts(key);
			} catch (cause) {
				recordAttempt(key, 60 * 60 * 1000);
				const status =
					(cause as { statusCode?: number; status?: number }).statusCode ??
					(cause as { status?: number }).status;
				if (status === 400) {
					return fail(400, { ok: false, message: t('profile.currentPasswordInvalid') });
				}
				throw cause;
			}
			return { ok: true, message: t('profile.passwordChanged') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
