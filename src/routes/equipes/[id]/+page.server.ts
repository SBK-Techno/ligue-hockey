import type { Actions, ServerLoad } from '@sveltejs/kit';
import { TEAM_SECTION } from '#config/teams.ts';
import { can } from '#lib/domain/auth/policy.ts';
import {
	applyBestSwap,
	fillOpenSlots,
	lineupIntelligence,
	type LineupIntelligence
} from '#lib/domain/games/alignment.ts';
import { saveManualLineup } from '#lib/domain/games/lineup.ts';
import { isLineupEditable } from '#lib/domain/games/playability.ts';
import { scheduleView } from '#lib/domain/games/schedule.ts';
import {
	getGame,
	listSchedule,
	listTeamHistory,
	regenerateAsAdmin,
	type TeamHistoryEntry
} from '#lib/domain/games/service.ts';
import { manualLineupInputSchema } from '#lib/domain/games/validators.ts';
import { actionError, loadError } from '#lib/server/action.ts';
import { AppError } from '#lib/shared/errors.ts';
import { formatCount, t } from '#lib/shared/i18n/index.ts';
import { parseSchema } from '#lib/shared/validation.ts';

export const load: ServerLoad = async ({ locals, params, parent }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user' || !params.id) {
		return {
			game: null,
			canManage: false,
			editable: false,
			hasPlayerProfile: false,
			ownTeam: null,
			intelligence: null,
			history: [] as TeamHistoryEntry[],
			hasMoreHistory: false,
			nextGameId: null,
			isNext: false,
			isPastGame: false
		};
	}

	const schedule = listSchedule(actor);
	if (!schedule.some((game) => game.id === params.id)) {
		return loadError(new AppError('NOT_FOUND', { key: 'games.noMatch' }));
	}

	const view = scheduleView(schedule);
	const game = getGame(actor, params.id);
	const canManage = can(actor, 'manageGames');
	const editable = isLineupEditable(game);
	const intelligence: LineupIntelligence | null =
		canManage && editable && game.generated ? lineupIntelligence(actor, game) : null;

	const { hasPlayerProfile } = await parent();
	const ownTeam = hasPlayerProfile
		? (game.slots.find((slot) => slot.player?.playerId === actor.userId)?.team ?? null)
		: null;
	const history = listTeamHistory(
		actor,
		view.past.slice(0, TEAM_SECTION.historyLimit).map((entry) => entry.id)
	);

	return {
		game,
		canManage,
		editable,
		hasPlayerProfile,
		ownTeam,
		intelligence,
		history,
		hasMoreHistory: view.past.length > history.length,
		nextGameId: view.nextId,
		isNext: view.nextId === game.id,
		isPastGame: view.past.some((entry) => entry.id === game.id)
	};
};

export const actions: Actions = {
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
			return { ok: true, section: 'lineup', message: t('rink.saved') };
		} catch (cause) {
			return actionError(cause, { section: 'lineup' });
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
	swap: async ({ locals, params }) => {
		try {
			applyBestSwap(locals.actor, params.id!);
			return { ok: true, message: t('games.swapDone') };
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
				)
			};
		} catch (cause) {
			return actionError(cause);
		}
	}
};
