import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { AUTH_POLICY } from '#config/account.ts';
import { PLAYER_LIMITS } from '#config/players.ts';
import { requestPasswordResetLink } from '#lib/domain/auth/service.ts';
import { actionError } from '#lib/server/action.ts';
import { recordAttempt, tooManyAttempts } from '#lib/server/security/throttle.ts';
import { env } from '#lib/shared/config/env.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const resetRequestSchema = z.object({
	email: z.string().trim().toLowerCase().email().max(PLAYER_LIMITS.emailMax)
});

export const load: ServerLoad = ({ locals }) => {
	if (locals.actor.kind === 'user') redirect(303, '/profil');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		if (locals.actor.kind === 'user') {
			return fail(403, { ok: false, message: t('error.forbidden') });
		}
		try {
			const parsed = parseForm(resetRequestSchema, await request.formData());
			const key = `reset:${getClientAddress()}:${parsed.email}`;
			if (tooManyAttempts(key, env.security.resetRequestsPerHour)) {
				return fail(429, { ok: false, message: t('auth.throttled') });
			}
			recordAttempt(key, AUTH_POLICY.passwordWindowSeconds * 1000);
			await requestPasswordResetLink(parsed);
			return { ok: true, sent: true, message: t('auth.reset.sent') };
		} catch (cause) {
			const status =
				(cause as { statusCode?: number; status?: number }).statusCode ??
				(cause as { status?: number }).status;
			if (status === 429) {
				return fail(429, { ok: false, message: t('auth.throttled') });
			}
			return actionError(cause);
		}
	}
};
