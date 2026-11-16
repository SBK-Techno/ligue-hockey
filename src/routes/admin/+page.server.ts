import type { ServerLoad } from '@sveltejs/kit';
import { branding } from '#lib/generated/branding.ts';
import { getAvailability } from '#lib/domain/availability/service.ts';
import { listBalances } from '#lib/domain/finance/service.ts';
import { getGame, listSchedule } from '#lib/domain/games/service.ts';
import { listAdminPlayers } from '#lib/domain/players/service.ts';
import { listOpenRequests } from '#lib/domain/roster/service.ts';
import { can } from '#lib/domain/auth/policy.ts';
import { clock, todayInZone } from '#lib/shared/time/clock.ts';

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
			currency: ''
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
	const today = todayInZone(branding.timezone, clock.nowMs());
	const upcomingAll = permissions.games
		? listSchedule(actor).filter(
				(game) => game.status === 'scheduled' && game.gameDate >= today
			)
		: [];
	const next = upcomingAll[0] ?? null;
	const nextGame = next ? getGame(actor, next.id) : null;
	const nextAvailability = next ? getAvailability(actor, next.id) : null;
	const upcoming = upcomingAll.slice(1, 4);
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
		currency: balances[0]?.currency ?? ''
	};
};
