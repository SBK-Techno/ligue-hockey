import type { Actions, ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { POSITION_KEYS } from '#config/positions.ts';
import { getAvailability, markAvailability } from '#lib/domain/availability/service.ts';
import {
	cancelRequest,
	claimSubstitute,
	createManualRequest,
	listRequestsForGame,
	releaseSubstitute
} from '#lib/domain/roster/service.ts';
import { getGame, regenerateAsAdmin } from '#lib/domain/games/service.ts';
import { can } from '#lib/domain/auth/policy.ts';
import { isSubstitutePlayer } from '#lib/domain/players/service.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const availabilitySchema = z.object({
	status: z.enum(['present', 'absent'])
});

const requestSchema = z.object({
	requestId: z.string().min(1)
});

const manualRequestSchema = z.object({
	position: z.enum(POSITION_KEYS)
});

export const load: ServerLoad = ({ locals, params }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') {
		return {
			game: null,
			availability: null,
			requests: [],
			isSubstitute: false,
			canManage: false
		};
	}
	const gameId = params.id;
	if (!gameId) {
		return {
			game: null,
			availability: null,
			requests: [],
			isSubstitute: false,
			canManage: false
		};
	}

	return {
		game: getGame(actor, gameId),
		availability: getAvailability(actor, gameId),
		requests: listRequestsForGame(actor, gameId),
		isSubstitute: isSubstitutePlayer(actor),
		canManage: can(actor, 'manageGames')
	};
};

export const actions: Actions = {
	availability: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(availabilitySchema, await request.formData());
			const result = markAvailability(locals.actor, params.id!, parsed.status);
			return {
				ok: true,
				message: result.warning ? t(result.warning) : t('availability.saved')
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
	},
	claim: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(requestSchema, await request.formData());
			const result = claimSubstitute(locals.actor, params.id!, parsed.requestId);
			return {
				ok: true,
				message: result.warning ? t(result.warning) : t('subs.claimed')
			};
		} catch (cause) {
			return actionError(cause);
		}
	},
	release: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(requestSchema, await request.formData());
			const result = releaseSubstitute(locals.actor, params.id!, parsed.requestId);
			return {
				ok: true,
				message: result.warning ? t(result.warning) : t('subs.declined')
			};
		} catch (cause) {
			return actionError(cause);
		}
	},
	cancelRequest: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(requestSchema, await request.formData());
			cancelRequest(locals.actor, params.id!, parsed.requestId);
			return { ok: true, message: t('subs.requestCancelled') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	requestSub: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(manualRequestSchema, await request.formData());
			createManualRequest(locals.actor, params.id!, parsed.position);
			return { ok: true, message: t('subs.requestCreated') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
