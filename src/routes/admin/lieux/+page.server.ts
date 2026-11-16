import type { Actions, ServerLoad } from '@sveltejs/kit';
import { can } from '#lib/domain/auth/policy.ts';
import {
	createLocation,
	deleteLocation,
	listLocationMetrics,
	listLocations,
	updateLocation
} from '#lib/domain/locations/service.ts';
import {
	locationDeleteSchema,
	locationInputSchema,
	locationUpdateSchema
} from '#lib/domain/locations/validators.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user' || !can(actor, 'manageGames')) {
		return { locations: [], metrics: [] };
	}
	return {
		locations: listLocations(actor),
		metrics: listLocationMetrics(actor)
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		try {
			const parsed = parseForm(locationInputSchema, await request.formData());
			createLocation(locals.actor, parsed);
			return { ok: true, message: t('admin.locationSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	update: async ({ request, locals }) => {
		try {
			const parsed = parseForm(locationUpdateSchema, await request.formData());
			updateLocation(locals.actor, parsed);
			return { ok: true, message: t('admin.locationSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	delete: async ({ request, locals }) => {
		try {
			const parsed = parseForm(locationDeleteSchema, await request.formData());
			deleteLocation(locals.actor, parsed);
			return { ok: true, message: t('admin.locationDeleted') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
