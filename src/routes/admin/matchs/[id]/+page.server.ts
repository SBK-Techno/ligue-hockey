import type { Actions, ServerLoad } from '@sveltejs/kit';
import {
	cancelGame,
	getGame,
	updateGame
} from '#lib/domain/games/service.ts';
import { can } from '#lib/domain/auth/policy.ts';
import { isGamePlayable, isLineupEditable } from '#lib/domain/games/playability.ts';
import { listLocations } from '#lib/domain/locations/service.ts';
import { actionError } from '#lib/server/action.ts';
import { formatDate, t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';
import { updateGameInputSchema } from '#lib/domain/games/validators.ts';

export const load: ServerLoad = ({ locals, params }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user' || !params.id) {
		return {
			game: null,
			canAssess: false,
			canManage: false,
			editable: false,
			locations: []
		};
	}
	const game = getGame(actor, params.id);
	const canManage = can(actor, 'manageGames');

	return {
		game,
		detailTitle: formatDate(game.gameDate),
		canAssess: can(actor, 'editRatings') && isGamePlayable(game),
		canManage,
		editable: isLineupEditable(game),
		locations: canManage ? listLocations(actor) : []
	};
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(updateGameInputSchema, await request.formData());
			updateGame(locals.actor, params.id!, parsed);
			return { ok: true, message: t('admin.gameSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	cancel: async ({ locals, params }) => {
		try {
			cancelGame(locals.actor, params.id!);
			return { ok: true, message: t('admin.gameCancelled') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
