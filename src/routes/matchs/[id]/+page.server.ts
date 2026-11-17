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
import { saveManualLineup } from '#lib/domain/games/lineup.ts';
import { manualLineupInputSchema } from '#lib/domain/games/validators.ts';
import { isGameStarted, isLineupEditable } from '#lib/domain/games/playability.ts';
import { can } from '#lib/domain/auth/policy.ts';
import { isSubstitutePlayer } from '#lib/domain/players/service.ts';
import type { Position } from '#config/positions.ts';
import { getMySubProfile } from '#lib/domain/subs/service.ts';
import {
	addGoal,
	addPenalty,
	deleteGoal,
	deletePenalty,
	finalizeGame,
	getGameSheet
} from '#lib/domain/gamesheet/service.ts';
import {
	goalFormInputSchema,
	penaltyFormInputSchema
} from '#lib/domain/gamesheet/validators.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm, parseSchema } from '#lib/shared/validation.ts';
import { AppError } from '#lib/shared/errors.ts';

const availabilitySchema = z.object({
	status: z.enum(['present', 'absent'])
});

const requestSchema = z.object({
	requestId: z.string().min(1)
});

const manualRequestSchema = z.object({
	position: z.enum(POSITION_KEYS)
});

const goalIdSchema = z.object({ goalId: z.string().min(1) });
const penaltyIdSchema = z.object({ penaltyId: z.string().min(1) });

export const load: ServerLoad = ({ locals, params }) => {
	const actor = locals.actor;
	const positions: Position[] =
		actor.kind === 'user' ? getMySubProfile(actor).positions : [];
	if (actor.kind !== 'user') {
		return {
			game: null,
			availability: null,
			requests: [],
			isSubstitute: false,
			positions,
			canManage: false,
			editable: false,
			started: false,
			sheet: null
		};
	}
	const gameId = params.id;
	if (!gameId) {
		return {
			game: null,
			availability: null,
			requests: [],
			isSubstitute: false,
			positions,
			canManage: false,
			editable: false,
			started: false,
			sheet: null
		};
	}

	const game = getGame(actor, gameId);
	const started = isGameStarted(game);
	return {
		game,
		editable: isLineupEditable(game),
		started,
		sheet: started ? getGameSheet(actor, gameId) : null,
		availability: getAvailability(actor, gameId),
		requests: listRequestsForGame(actor, gameId),
		isSubstitute: isSubstitutePlayer(actor),
		positions,
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
				message: t(result.warning ?? result.messageKey)
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
			const result = cancelRequest(locals.actor, params.id!, parsed.requestId);
			return {
				ok: true,
				message: result.warning ? t(result.warning) : t('subs.requestCancelled')
			};
		} catch (cause) {
			return actionError(cause);
		}
	},
	goal: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(goalFormInputSchema, await request.formData());
			addGoal(locals.actor, params.id!, parsed);
			return { ok: true, message: t('gamesheet.goalSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	penalty: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(penaltyFormInputSchema, await request.formData());
			addPenalty(locals.actor, params.id!, parsed);
			return { ok: true, message: t('gamesheet.penaltySaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	deleteGoal: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(goalIdSchema, await request.formData());
			deleteGoal(locals.actor, params.id!, parsed.goalId);
			return { ok: true, message: t('gamesheet.goalDeleted') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	deletePenalty: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(penaltyIdSchema, await request.formData());
			deletePenalty(locals.actor, params.id!, parsed.penaltyId);
			return { ok: true, message: t('gamesheet.penaltyDeleted') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	finalize: async ({ locals, params }) => {
		try {
			finalizeGame(locals.actor, params.id!);
			return { ok: true, message: t('gamesheet.finalized') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	lineup: async ({ request, locals, params }) => {
		try {
			const form = await request.formData();
			const rawToken = String(form.get('expectedGeneratedAt') ?? '');
			const token = rawToken === '' ? null : Number(rawToken);
			let assignments: unknown;
			try {
				assignments = JSON.parse(String(form.get('lineup') ?? ''));
			} catch {
				throw new AppError('VALIDATION', { key: 'rink.invalid' });
			}
			const parsed = parseSchema(manualLineupInputSchema, {
				expectedGeneratedAt: token,
				assignments
			});
			saveManualLineup(locals.actor, params.id!, parsed);
			return { ok: true, message: t('rink.saved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	requestSub: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(manualRequestSchema, await request.formData());
			const result = createManualRequest(locals.actor, params.id!, parsed.position);
			return {
				ok: true,
				message: result.warning ? t(result.warning) : t('subs.requestCreated')
			};
		} catch (cause) {
			return actionError(cause);
		}
	}
};
