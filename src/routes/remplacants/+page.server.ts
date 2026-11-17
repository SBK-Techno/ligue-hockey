import type { Actions, ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { POSITION_KEYS } from '#config/positions.ts';
import { can } from '#lib/domain/auth/policy.ts';
import {
	adminUpdatePlayer,
	invitePlayer,
	isSubstitutePlayer
} from '#lib/domain/players/service.ts';
import { invitePlayerSchema, playerIdInputSchema } from '#lib/domain/players/validators.ts';
import {
	cancelRequest,
	claimSubstitute,
	createManualRequest,
	listOpenRequests,
	listRequestableGames,
	listSubstitutePool
} from '#lib/domain/roster/service.ts';
import { getGame } from '#lib/domain/games/service.ts';
import {
	cancelOwnRequest,
	getMySubProfile,
	saveMySubProfile,
	setSubstituteFavorite
} from '#lib/domain/subs/service.ts';
import {
	subFavoriteInputSchema,
	subProfileInputSchema,
	subRequestRefSchema
} from '#lib/domain/subs/validators.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const requestSchema = z.object({
	gameId: z.string().min(1),
	position: z.enum(POSITION_KEYS)
});

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') {
		return {
			requests: [],
			pool: [],
			positions: [],
			games: [],
			isSubstitute: false,
			canManageRequests: false,
			canManagePool: false,
			canManageGames: false
		};
	}
	const canManageRequests = can(actor, 'manageSubs');
	return {
		requests: listOpenRequests(actor),
		pool: listSubstitutePool(actor),
		positions: getMySubProfile(actor).positions,
		games: canManageRequests ? listRequestableGames(actor) : [],
		isSubstitute: isSubstitutePlayer(actor),
		canManageRequests,
		canManagePool: can(actor, 'managePlayers'),
		canManageGames: can(actor, 'manageGames')
	};
};

export const actions: Actions = {
	inviteSubstitute: async ({ request, locals }) => {
		try {
			const parsed = parseForm(invitePlayerSchema, await request.formData());
			const result = await invitePlayer(locals.actor, {
				...parsed,
				isSubstitute: true
			});
			return {
				ok: true,
				message: result.inviteQueued
					? t('admin.inviteSent')
					: t('admin.inviteEmailFailed')
			};
		} catch (cause) {
			return actionError(cause);
		}
	},
	favorite: async ({ request, locals }) => {
		try {
			const parsed = parseForm(subFavoriteInputSchema, await request.formData());
			setSubstituteFavorite(locals.actor, {
				playerId: parsed.playerId,
				favorite: parsed.favorite
			});
			return { ok: true, message: t('admin.playerSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	removeSubstitute: async ({ request, locals }) => {
		try {
			const parsed = parseForm(playerIdInputSchema, await request.formData());
			await adminUpdatePlayer(locals.actor, parsed.playerId, {
				isSubstitute: false
			});
			return { ok: true, message: t('admin.playerSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	request: async ({ request, locals }) => {
		try {
			const parsed = parseForm(requestSchema, await request.formData());
			const result = createManualRequest(locals.actor, parsed.gameId, parsed.position);
			return {
				ok: true,
				message: result.warning ? t(result.warning) : t('subs.requestCreated')
			};
		} catch (cause) {
			return actionError(cause);
		}
	},
	cancel: async ({ request, locals }) => {
		try {
			const parsed = parseForm(subRequestRefSchema, await request.formData());
			const result = cancelRequest(locals.actor, parsed.gameId, parsed.requestId);
			return {
				ok: true,
				message: result.warning ? t(result.warning) : t('subs.requestCancelled')
			};
		} catch (cause) {
			return actionError(cause);
		}
	},
	cancelOwn: async ({ request, locals }) => {
		try {
			const parsed = parseForm(subRequestRefSchema, await request.formData());
			const game = getGame(locals.actor, parsed.gameId);
			cancelOwnRequest(locals.actor, game, parsed.requestId);
			return { ok: true, message: t('subs.requestCancelled') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	saveProfile: async ({ request, locals }) => {
		try {
			const parsed = parseForm(subProfileInputSchema, await request.formData());
			saveMySubProfile(locals.actor, { positions: parsed.positions });
			return { ok: true, message: t('subs.profileSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	claim: async ({ request, locals }) => {
		try {
			const parsed = parseForm(subRequestRefSchema, await request.formData());
			const result = claimSubstitute(locals.actor, parsed.gameId, parsed.requestId);
			return {
				ok: true,
				message: result.warning ? t(result.warning) : t('subs.claimed')
			};
		} catch (cause) {
			return actionError(cause);
		}
	}
};
