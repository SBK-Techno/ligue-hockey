import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { ACCOUNT_LIMITS } from '#config/account.ts';
import { PLAYER_LIMITS } from '#config/players.ts';
import { auth } from '#lib/server/auth.ts';
import { actionError } from '#lib/server/action.ts';
import {
	clearAttempts,
	recordAttempt,
	tooManyAttempts
} from '#lib/server/security/throttle.ts';
import { env } from '#lib/shared/config/env.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const loginSchema = z.object({
	email: z.string().trim().toLowerCase().email().max(PLAYER_LIMITS.emailMax),
	password: z.string().min(1).max(ACCOUNT_LIMITS.passwordMax),
	next: z.string().trim().max(2048).optional()
});

function safeNext(value: string | null | undefined): string {
	if (
		!value ||
		!value.startsWith('/') ||
		value.startsWith('//') ||
		value.includes('\\') ||
		[...value].some((character) => character.charCodeAt(0) < 32)
	) {
		return '/';
	}
	return value;
}

export const load: ServerLoad = ({ url }) => {
	return {
		next: safeNext(url.searchParams.get('prochaine')),
		reset: url.searchParams.get('reinitialise') === '1'
	};
};

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		let parsed;
		try {
			parsed = parseForm(loginSchema, form);
		} catch (cause) {
			return actionError(cause);
		}

		const key = `login:${getClientAddress()}:${parsed.email}`;
		const windowMs = env.security.loginWindowMinutes * 60 * 1000;
		if (tooManyAttempts(key, env.security.maxLoginAttempts)) {
			return fail(429, { ok: false, message: t('auth.throttled') });
		}

		try {
			await auth.api.signInEmail({
				body: {
					email: parsed.email,
					password: parsed.password
				},
				headers: request.headers
			});
			clearAttempts(key);
		} catch (cause) {
			recordAttempt(key, windowMs);
			const status =
				(cause as { statusCode?: number; status?: number }).statusCode ??
				(cause as { status?: number }).status;
			if (status === 429) {
				return fail(429, { ok: false, message: t('auth.throttled') });
			}
			return fail(400, { ok: false, message: t('auth.invalid') });
		}

		redirect(303, safeNext(parsed.next));
	}
};
