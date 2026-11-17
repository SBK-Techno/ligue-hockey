import { redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { safeRedirectPath, signIn } from '#lib/domain/auth/service.ts';
import { actionError } from '#lib/server/action.ts';
import { formToObject } from '#lib/shared/validation.ts';
import { resetMode } from '#lib/ui/reset-mode.ts';

export const load: ServerLoad = ({ url }) => {
	return {
		next: safeRedirectPath(url.searchParams.get('prochaine')),
		reset: url.searchParams.get('reinitialise') === '1',
		mode: resetMode(url.searchParams.get('mode'))
	};
};

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		let next: string;
		try {
			({ next } = await signIn(formToObject(form), {
				address: getClientAddress(),
				headers: request.headers
			}));
		} catch (cause) {
			return actionError(cause, { email });
		}
		redirect(303, next);
	}
};
