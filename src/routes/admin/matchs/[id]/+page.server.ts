import type { Actions, ServerLoad } from '@sveltejs/kit';
import {
	cancelGame,
	getGame,
	regenerateAsAdmin,
	updateGame
} from '#lib/domain/games/service.ts';
import { can } from '#lib/domain/auth/policy.ts';
import { applyBestSwap, fillOpenSlots, lineupIntelligence } from '#lib/domain/games/alignment.ts';
import { isGamePlayable } from '#lib/domain/games/playability.ts';
import { listLocations } from '#lib/domain/locations/service.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';
import { gameInputSchema } from '#lib/domain/games/validators.ts';

export const load: ServerLoad = ({ locals, params }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user' || !params.id) {
		return { game: null, canAssess: false, intelligence: null, locations: [] };
	}
	const game = getGame(actor, params.id);
	return {
		game,
		canAssess: can(actor, 'editRatings') && isGamePlayable(game),
		intelligence: lineupIntelligence(game),
		locations: can(actor, 'manageGames') ? listLocations(actor) : []
	};
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(gameInputSchema, await request.formData());
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
	},
	swap: async ({ locals, params }) => {
		try {
			const intelligence = applyBestSwap(locals.actor, params.id!);
			return { ok: true, message: t('games.swapDone'), intelligence };
		} catch (cause) {
			return actionError(cause);
		}
	},
	fill: async ({ locals, params }) => {
		try {
			const intelligence = fillOpenSlots(locals.actor, params.id!);
			return {
				ok: true,
				message: t('games.fillDone', { count: intelligence.fills.count }),
				intelligence
			};
		} catch (cause) {
			return actionError(cause);
		}
	},
	generate: async ({ locals, params }) => {
		try {
			regenerateAsAdmin(locals.actor, params.id!);
			return { ok: true, message: t('games.generated') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
