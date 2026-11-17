import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { actorFromUser } from '#lib/domain/auth/types.ts';
import { isAccountActive } from '#lib/domain/players/account-status.ts';
import { actorContextRequired } from '#lib/server/actor-context.ts';
import { cacheControlFor } from '#lib/server/cache-policy.ts';
import { compressResponse } from '#lib/server/compression.ts';
import { auth } from '#lib/server/auth.ts';
import { startup } from '#lib/server/startup.ts';
import { isAppError } from '#lib/shared/errors.ts';
import { errorStatus } from '#lib/server/error-status.ts';
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
	event.locals.sessionId = null;

	if (building) {
		return resolve(event);
	}

	await startup();

	const startedAt = clock.nowMs();
	// Assets never read the actor: skip both the session lookup and the player
	// activity read so an immutable file costs no SQLite query.
	const session = actorContextRequired(event.url.pathname)
		? await auth.api.getSession({ headers: event.request.headers })
		: null;
	event.locals.actor = session?.user
		? actorFromUser({
				...session.user,
				active: isAccountActive(session.user.id)
			})
		: actorFromUser(null);
	event.locals.sessionId = session?.session?.id ?? null;

	const response = await svelteKitHandler({
		event,
		resolve,
		auth,
		building
	});

	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(name, value);
	}
	const cacheControl = cacheControlFor({
		pathname: event.url.pathname,
		hasSession: Boolean(session?.session),
		declared: response.headers.get('cache-control'),
		contentType: response.headers.get('content-type')
	});
	if (cacheControl) response.headers.set('Cache-Control', cacheControl);
	if (
		event.url.pathname === '/reinitialiser-mot-de-passe' ||
		event.url.pathname.startsWith('/api/auth/reset-password/')
	) {
		response.headers.set('Referrer-Policy', 'no-referrer');
	}

	const delivered = compressResponse(event.request, response);

	logger.info('http.request', {
		method: event.request.method,
		path: event.url.pathname,
		status: delivered.status,
		durationMs: clock.nowMs() - startedAt,
		requestId: event.locals.requestId
	});

	return delivered;
};

export const handleError: HandleServerError = (input) => {
	const { error, event } = input;

	if (input.kind === 'app') {
		const status = errorStatus('app', input.error.status);
		logger.warn('http.app_error', {
			code: status,
			path: event.url.pathname,
			requestId: event.locals.requestId
		});
		return {
			message: input.error.message,
			key: input.error.key,
			status
		};
	}

	const caughtStatus =
		input.kind === 'framework' || input.kind === 'validation'
			? input.error.status
			: undefined;
	const status = errorStatus(
		input.kind,
		caughtStatus,
		isAppError(error) ? error.status : undefined
	);

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
