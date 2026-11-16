import type { ServerLoad } from '@sveltejs/kit';
import { branding } from '#lib/generated/branding.ts';
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
			requests: [],
			nextGame: null,
			upcoming: [],
			permissions: { players: false, balances: false, games: false, subs: false },
			counts: { active: 0, subs: 0, overdue: 0, openRequests: 0 }
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
	const next = permissions.games
		? (listSchedule(actor).find(
				(game) => game.status === 'scheduled' && game.gameDate >= today
			) ?? null)
		: null;
	const nextGame = next ? getGame(actor, next.id) : null;
	const upcoming = permissions.games
		? listSchedule(actor)
				.filter((game) => game.status === 'scheduled' && game.gameDate >= today)
				.slice(1, 4)
		: [];

	return {
		players,
		balances,
		requests,
		nextGame,
		upcoming,
		permissions,
		counts: {
			active: players.filter((player) => player.active).length,
			subs: players.filter((player) => player.active && player.isSubstitute).length,
			overdue: balances.filter((balance) => balance.isOverdue).length,
			openRequests: requests.length
		}
	};
};
