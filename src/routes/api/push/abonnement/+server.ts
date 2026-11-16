import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	subscribeToPush,
	unsubscribeFromPush
} from '#lib/domain/notifications/service.ts';
import { isAppError } from '#lib/shared/errors.ts';

function failure(cause: unknown) {
	const status = isAppError(cause) ? cause.status : 500;
	return json({ ok: false }, { status });
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = (await request.json()) as {
			endpoint?: string;
			keys?: { p256dh?: string; auth?: string };
		};
		subscribeToPush(locals.actor, {
			endpoint: body.endpoint ?? '',
			keys: {
				p256dh: body.keys?.p256dh ?? '',
				auth: body.keys?.auth ?? ''
			},
			userAgent: request.headers.get('user-agent') ?? undefined
		});
		return json({ ok: true });
	} catch (cause) {
		return failure(cause);
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	try {
		const body = (await request.json()) as { endpoint?: string };
		unsubscribeFromPush(locals.actor, body.endpoint ?? '');
		return json({ ok: true });
	} catch (cause) {
		return failure(cause);
	}
};
