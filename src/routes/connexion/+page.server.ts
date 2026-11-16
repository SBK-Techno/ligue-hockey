import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { auth } from '#lib/server/auth.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const loginSchema = z.object({
	email: z.string().trim().toLowerCase().email().max(254),
	password: z.string().min(1).max(128),
	next: z.string().trim().max(2048).optional()
});

function safeNext(value: string | null | undefined): string {
	if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
	return value;
}

export const load: ServerLoad = ({ url }) => {
	return {
		next: safeNext(url.searchParams.get('prochaine')),
		reset: url.searchParams.get('reinitialise') === '1'
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		let parsed;
		try {
			parsed = parseForm(loginSchema, form);
		} catch (cause) {
			return actionError(cause);
		}

		try {
			await auth.api.signInEmail({
				body: {
					email: parsed.email,
					password: parsed.password
				},
				headers: request.headers
			});
		} catch (cause) {
			const status =
				(cause as { statusCode?: number; status?: number }).statusCode ??
				(cause as { status?: number }).status;
			if (status === 429) {
				return fail(429, { message: t('auth.throttled') });
			}
			return fail(400, { message: t('auth.invalid') });
		}

		redirect(303, safeNext(parsed.next));
	}
};
