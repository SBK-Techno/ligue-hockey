import { json } from '@sveltejs/kit';
import { ABUSE_LIMITS } from '#config/abuse.ts';
import { ADDRESS_SEARCH_CACHE } from '#config/cache.ts';
import { LOCATION_LIMITS } from '#config/games.ts';
import { ADDRESS_SEARCH } from '#config/maps.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import { apiError } from '#lib/server/action.ts';
import { searchAddresses } from '#lib/server/geocoding.ts';
import { consumeAttempt } from '#lib/server/security/throttle.ts';
import { AppError } from '#lib/shared/errors.ts';
import type { RequestHandler } from './$types';

/**
 * Transport only: the geocoding adapter owns the provider, cache and timeout.
 * The route adds the capability check and the per-member search bucket.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const user = requirePermission(locals.actor, 'manageGames');

		const query = (url.searchParams.get('q') ?? '').trim();
		if (query.length < ADDRESS_SEARCH.minChars || query.length > LOCATION_LIMITS.addressMax) {
			throw new AppError('VALIDATION', { key: 'admin.addressQueryInvalid' });
		}

		const limit = ABUSE_LIMITS.addressSearch;
		if (
			!consumeAttempt(`address-search:${user.userId}`, limit.limit, limit.windowMs)
		) {
			throw new AppError('RATE_LIMITED');
		}

		return json(
			{ results: await searchAddresses(query) },
			{ headers: { 'cache-control': ADDRESS_SEARCH_CACHE } }
		);
	} catch (cause) {
		return apiError(cause);
	}
};
