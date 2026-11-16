import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { auth } from '#lib/server/auth.ts';
import { actionError } from '#lib/server/action.ts';
import { publicEnv } from '#lib/shared/config/public-env.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const resetSchema = z.object({
	token: z.string().trim().min(1).max(512),
	password: z.string().min(publicEnv.passwordMinLength).max(128),
	confirm: z.string().min(1).max(128)
});

export const load: ServerLoad = ({ url }) => {
	return {
		token: url.searchParams.get('token'),
		invalid: url.searchParams.get('error') === 'INVALID_TOKEN',
		minLength: publicEnv.passwordMinLength
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		let parsed;
		try {
			parsed = parseForm(resetSchema, form);
		} catch (cause) {
			return actionError(cause);
		}

		if (parsed.password !== parsed.confirm) {
			return fail(400, { message: t('invite.mismatch') });
		}

		try {
			await auth.api.resetPassword({
				body: {
					newPassword: parsed.password,
					token: parsed.token
				}
			});
		} catch (cause) {
			const status = (cause as { statusCode?: number }).statusCode;
			if (status === 400) {
				return fail(400, { message: t('invite.expired') });
			}
			throw cause;
		}

		redirect(303, '/connexion?reinitialise=1');
	}
};
