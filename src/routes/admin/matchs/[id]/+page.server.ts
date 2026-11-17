import type { Actions, ServerLoad } from '@sveltejs/kit';
import {
	cancelGame,
	getGame,
	updateGame
} from '#lib/domain/games/service.ts';
import { can } from '#lib/domain/auth/policy.ts';
import { applyBestSwap, fillOpenSlots, lineupIntelligence } from '#lib/domain/games/alignment.ts';
import { isGamePlayable, isLineupEditable } from '#lib/domain/games/playability.ts';
import { playersByIds } from '#lib/domain/players/candidates.ts';
import { listLocations } from '#lib/domain/locations/service.ts';
import { actionError } from '#lib/server/action.ts';
import { isAppError } from '#lib/shared/errors.ts';
import { formatCount, t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';
import { updateGameInputSchema } from '#lib/domain/games/validators.ts';

function missingRatingsNames(cause: unknown): { playerId: string; fullName: string }[] {
	if (!isAppError(cause) || cause.key !== 'games.ratingsMissing') return [];
	const details = cause.details as { playerIds?: unknown } | undefined;
	const ids = Array.isArray(details?.playerIds)
		? details.playerIds.filter((value): value is string => typeof value === 'string')
		: [];
	return playersByIds(ids).map((player) => ({
		playerId: player.userId,
		fullName: player.fullName
	}));
}

export const load: ServerLoad = ({ locals, params }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user' || !params.id) {
		return {
			game: null,
			canAssess: false,
			canManage: false,
			editable: false,
			intelligence: null,
			ratingsMissing: [],
			locations: []
		};
	}
	const game = getGame(actor, params.id);
	const canManage = can(actor, 'manageGames');
	let intelligence = null;
	let ratingsMissing: { playerId: string; fullName: string }[] = [];

	if (canManage) {
		try {
			intelligence = lineupIntelligence(actor, game);
		} catch (cause) {
			const names = missingRatingsNames(cause);
			if (names.length === 0) throw cause;
			ratingsMissing = names;
		}
	}

	return {
		game,
		canAssess: can(actor, 'editRatings') && isGamePlayable(game),
		canManage,
		editable: isLineupEditable(game),
		intelligence,
		ratingsMissing,
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
			const result = fillOpenSlots(locals.actor, params.id!);
			return {
				ok: true,
				message: formatCount(
					result.filled,
					'games.fillDone.one',
					'games.fillDone.many'
				),
				intelligence: result.intelligence
			};
		} catch (cause) {
			return actionError(cause);
		}
	}
};
