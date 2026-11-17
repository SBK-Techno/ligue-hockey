import type { Actions, ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { getAvailability } from '#lib/domain/availability/service.ts';
import { listBalances } from '#lib/domain/finance/service.ts';
import { getGame, listSchedule } from '#lib/domain/games/service.ts';
import { nextGameId, splitSchedule } from '#lib/domain/games/schedule.ts';
import { listAdminPlayers } from '#lib/domain/players/service.ts';
import { listOpenRequests } from '#lib/domain/roster/service.ts';
import { can } from '#lib/domain/auth/policy.ts';
import { listFailedJobs, retryFailedJob } from '#lib/domain/notifications/service.ts';
import { queueSnapshot } from '#lib/server/notifications/status.ts';
import { triggerNotificationTick } from '#lib/server/notifications/scheduler.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const retrySchema = z.object({
	jobId: z.string().min(1)
});

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') {
		return {
			players: [],
			balances: [],
			unpaid: [],
			withoutPlan: [],
			requests: [],
			nextGame: null,
			nextAvailability: null,
			upcoming: [],
			permissions: { players: false, balances: false, games: false, subs: false },
			counts: {
				active: 0,
				subs: 0,
				overdue: 0,
				unpaid: 0,
				noPlan: 0,
				unanswered: 0,
				openRequests: 0
			},
			outstandingCents: 0,
			currency: '',
			notifications: null
		};
	}

	const permissions = {
		players: can(actor, 'managePlayers'),
		balances: can(actor, 'viewAllBalances'),
		games: can(actor, 'manageGames'),
		subs: can(actor, 'manageSubs') || can(actor, 'manageGames')
	};
	const players = permissions.players ? listAdminPlayers(actor) : [];
	const balances = permissions.balances ? listBalances(actor) : [];
	const requests = permissions.subs ? listOpenRequests(actor) : [];
	const schedule = permissions.games ? listSchedule(actor) : [];
	const { upcoming: upcomingAll } = splitSchedule(schedule);
	const nextId = nextGameId(schedule);
	const next = nextId ? (upcomingAll.find((game) => game.id === nextId) ?? null) : null;
	const nextGame = next ? getGame(actor, next.id) : null;
	const nextAvailability = next ? getAvailability(actor, next.id) : null;
	const upcoming = upcomingAll.filter((game) => game.id !== nextId).slice(0, 3);
	const unpaid = balances.filter((balance) => balance.outstandingCents > 0);
	const withoutPlan = balances.filter((balance) => !balance.hasPlan);

	return {
		players,
		balances,
		unpaid,
		withoutPlan,
		requests,
		nextGame,
		nextAvailability,
		upcoming,
		permissions,
		counts: {
			active: players.filter((player) => player.active).length,
			subs: players.filter((player) => player.active && player.isSubstitute).length,
			overdue: balances.filter((balance) => balance.isOverdue).length,
			unpaid: unpaid.length,
			noPlan: balances.filter((balance) => !balance.hasPlan).length,
			unanswered: nextAvailability?.unknown ?? 0,
			openRequests: requests.length
		},
		outstandingCents: balances.reduce((total, balance) => total + balance.outstandingCents, 0),
		currency: balances[0]?.currency ?? '',
		// Le panneau d'exploitation n'expose que des compteurs et des travaux
		// sans destinataire ni contenu.
		notifications: can(actor, 'manageSettings')
			? { snapshot: queueSnapshot(), failed: listFailedJobs(actor) }
			: null
	};
};

export const actions: Actions = {
	retry: async ({ request, locals }) => {
		try {
			const parsed = parseForm(retrySchema, await request.formData());
			retryFailedJob(locals.actor, parsed.jobId);
			triggerNotificationTick();
			return { ok: true, message: t('notifications.retryDone') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
