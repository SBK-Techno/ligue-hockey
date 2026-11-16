import type { Actions, ServerLoad } from '@sveltejs/kit';
import { createGame, listSchedule } from '#lib/domain/games/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';
import { gameInputSchema } from '#lib/domain/games/validators.ts';

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	const settings = getSettings();
	if (actor.kind !== 'user') {
		return {
			games: [],
			defaults: {
				location: settings['games.defaultLocation'],
				time: settings['games.defaultStartTime']
			}
		};
	}
	return {
		games: listSchedule(actor),
		defaults: {
			location: settings['games.defaultLocation'],
			time: settings['games.defaultStartTime']
		}
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		try {
			const parsed = parseForm(gameInputSchema, await request.formData());
			createGame(locals.actor, parsed);
			return { message: t('admin.gameSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
