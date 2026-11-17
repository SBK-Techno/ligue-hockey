import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { requestPasswordReset } from '#lib/domain/auth/service.ts';
import { actionError } from '#lib/server/action.ts';
import { formToObject } from '#lib/shared/validation.ts';
import { t } from '#lib/shared/i18n/index.ts';

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
			await requestPasswordReset(formToObject(await request.formData()), {
				address: getClientAddress()
			});
			return { ok: true, sent: true, message: t('auth.reset.sent') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
