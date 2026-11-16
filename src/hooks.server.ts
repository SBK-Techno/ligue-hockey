import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { actorFromUser } from '#lib/domain/auth/types.ts';
import { auth } from '#lib/server/auth.ts';
import { startup } from '#lib/server/startup.ts';
import { isAppError } from '#lib/shared/errors.ts';
import { t, type I18nKey } from '#lib/shared/i18n/index.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { logger } from '#lib/shared/logging/logger.ts';
import { clock } from '#lib/shared/time/clock.ts';

const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.requestId = newId('req');
	event.locals.actor = actorFromUser(null);

	if (building) {
		return resolve(event);
	}

	await startup();

	const startedAt = clock.nowMs();
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.actor = actorFromUser(session?.user);

	const response = await svelteKitHandler({
		event,
		resolve,
		auth,
		building
	});

	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(name, value);
	}
	if (session?.session) {
		response.headers.set('Cache-Control', 'private, no-store');
	}

	logger.info('http.request', {
		method: event.request.method,
		path: event.url.pathname,
		status: response.status,
		durationMs: clock.nowMs() - startedAt,
		requestId: event.locals.requestId
	});

	return response;
};

export const handleError: HandleServerError = (input) => {
	const { error, event } = input;
	const status =
		input.kind === 'framework' || input.kind === 'validation'
			? input.error.status
			: isAppError(error)
				? error.status
				: 500;

	if (isAppError(error)) {
		logger.warn('http.app_error', {
			code: error.code,
			path: event.url.pathname,
			requestId: event.locals.requestId
		});
		return { message: t(error.key), key: error.key, status };
	}

	logger.error('http.unhandled_error', {
		path: event.url.pathname,
		status,
		requestId: event.locals.requestId,
		error
	});

	const key: I18nKey =
		status === 404
			? 'error.notFound'
			: status === 403
				? 'error.forbidden'
				: 'error.generic';
	return { message: t(key), key, status };
};
