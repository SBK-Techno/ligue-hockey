import type { ServerLoad } from '@sveltejs/kit';
import { branding } from '#lib/generated/branding.ts';
import { listBalances } from '#lib/domain/finance/service.ts';
import { listSchedule } from '#lib/domain/games/service.ts';
import { listAdminPlayers } from '#lib/domain/players/service.ts';
import { listOpenRequests } from '#lib/domain/roster/service.ts';
import { clock, todayInZone } from '#lib/shared/time/clock.ts';

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') {
		return {
			players: [],
			balances: [],
			requests: [],
			nextGame: null,
			counts: { active: 0, subs: 0, overdue: 0, openRequests: 0 }
		};
	}

	const players = listAdminPlayers(actor);
	const balances = listBalances(actor);
	const requests = listOpenRequests(actor);
	const today = todayInZone(branding.timezone, clock.nowMs());
	const nextGame =
		listSchedule(actor).find(
			(game) => game.status === 'scheduled' && game.gameDate >= today
		) ?? null;

	return {
		players,
		balances,
		requests,
		nextGame,
		counts: {
			active: players.filter((player) => player.active).length,
			subs: players.filter((player) => player.active && player.isSubstitute).length,
			overdue: balances.filter((balance) => balance.isOverdue).length,
			openRequests: requests.length
		}
	};
};
