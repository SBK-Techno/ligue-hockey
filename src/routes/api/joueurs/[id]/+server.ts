import { json } from '@sveltejs/kit';
import { getPlayerPeek } from '#lib/domain/players/peek.ts';
import { isAppError } from '#lib/shared/errors.ts';
import { t } from '#lib/shared/i18n/index.ts';
import type { RequestHandler } from './$types';

/**
 * Transport only: the peek use case owns visibility, privacy and aggregation.
 * The response is private to the session and short-lived, because a player's
 * season totals move after every sheet.
 */
export const GET: RequestHandler = ({ locals, params }) => {
	try {
		return json(getPlayerPeek(locals.actor, params.id), {
			headers: { 'cache-control': 'private, max-age=15' }
		});
	} catch (cause) {
		if (isAppError(cause)) {
			return json(
				{ message: t(cause.key, cause.params) },
				{ status: cause.status }
			);
		}
		throw cause;
	}
};
