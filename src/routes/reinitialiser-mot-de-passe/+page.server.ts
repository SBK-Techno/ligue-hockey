import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { resetPassword } from '#lib/domain/auth/service.ts';
import { actionError } from '#lib/server/action.ts';
import { isAppError } from '#lib/shared/errors.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { formToObject } from '#lib/shared/validation.ts';
import { publicEnv } from '#lib/shared/config/public-env.ts';
import { resetMode, resetSuccessPath } from '#lib/ui/reset-mode.ts';

export const load: ServerLoad = ({ url }) => {
	return {
		token: url.searchParams.get('token'),
		mode: resetMode(url.searchParams.get('mode')),
		invalid: url.searchParams.get('error') === 'INVALID_TOKEN',
		minLength: publicEnv.passwordMinLength
	};
};

function fieldOf(cause: unknown): string | undefined {
	if (!isAppError(cause)) return undefined;
	const details = cause.details as Array<{ path?: string }> | undefined;
	return details?.find((entry) => entry.path)?.path;
}

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const mode = resetMode(String(form.get('mode') ?? ''));
		try {
			await resetPassword(formToObject(form));
		} catch (cause) {
			if (isAppError(cause) && cause.key === 'invite.expired') {
				return fail(400, {
					ok: false,
					mode,
					section: 'mot-de-passe',
					expired: true,
					message: t(cause.key, cause.params)
				});
			}
			return actionError(cause, {
				mode,
				section: 'mot-de-passe',
				expired: false,
				field: fieldOf(cause)
			});
		}
		redirect(303, resetSuccessPath(mode));
	}
};
