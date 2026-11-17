import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { ACCOUNT_LIMITS } from '#config/account.ts';
import { auth } from '#lib/server/auth.ts';
import { actionError } from '#lib/server/action.ts';
import { publicEnv } from '#lib/shared/config/public-env.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';
import { resetMode, resetSuccessPath } from '#lib/ui/reset-mode.ts';

const resetSchema = z.object({
	token: z.string().trim().min(1).max(512),
	mode: z.enum(['invite', 'reset']).default('reset'),
	password: z.string().min(publicEnv.passwordMinLength).max(ACCOUNT_LIMITS.passwordMax),
	confirm: z.string().min(1).max(ACCOUNT_LIMITS.passwordMax)
});

export const load: ServerLoad = ({ url }) => {
	return {
		token: url.searchParams.get('token'),
		mode: resetMode(url.searchParams.get('mode')),
		invalid: url.searchParams.get('error') === 'INVALID_TOKEN',
		minLength: publicEnv.passwordMinLength
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const mode = resetMode(String(form.get('mode') ?? ''));
		let parsed;
		try {
			parsed = parseForm(resetSchema, form);
		} catch (cause) {
			return actionError(cause, { mode, section: 'mot-de-passe', expired: false });
		}

		if (parsed.password !== parsed.confirm) {
			return fail(400, {
				ok: false,
				mode,
				section: 'mot-de-passe',
				field: 'confirm',
				message: t('invite.mismatch')
			});
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
				return fail(400, {
					ok: false,
					mode,
					section: 'mot-de-passe',
					expired: true,
					message: t('invite.expired')
				});
			}
			throw cause;
		}

		redirect(303, resetSuccessPath(parsed.mode));
	}
};
