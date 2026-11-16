import type { LayoutServerLoad } from './$types';
import { requireAdmin } from '#lib/domain/auth/policy.ts';
import { loadError } from '#lib/server/action.ts';

export const load: LayoutServerLoad = ({ locals }) => {
	try {
		return { actor: requireAdmin(locals.actor) };
	} catch (cause) {
		return loadError(cause);
	}
};
