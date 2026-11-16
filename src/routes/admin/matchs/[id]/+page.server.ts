import type { Actions, ServerLoad } from '@sveltejs/kit';
import {
	cancelGame,
	getGame,
	regenerateAsAdmin,
	updateGame
} from '#lib/domain/games/service.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';
import { gameInputSchema } from '#lib/domain/games/validators.ts';

export const load: ServerLoad = ({ locals, params }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user' || !params.id) return { game: null };
	return { game: getGame(actor, params.id) };
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(gameInputSchema, await request.formData());
			updateGame(locals.actor, params.id!, parsed);
			return { message: t('admin.gameSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	cancel: async ({ locals, params }) => {
		try {
			cancelGame(locals.actor, params.id!);
			return { message: t('admin.gameCancelled') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	generate: async ({ locals, params }) => {
		try {
			regenerateAsAdmin(locals.actor, params.id!);
			return { message: t('games.generated') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
