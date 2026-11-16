import type { ServerLoad } from '@sveltejs/kit';
import { branding } from '#lib/generated/branding.ts';
import { listSchedule } from '#lib/domain/games/service.ts';
import { clock, todayInZone } from '#lib/shared/time/clock.ts';

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') return { upcoming: [], past: [] };

	const schedule = listSchedule(actor);
	const today = todayInZone(branding.timezone, clock.nowMs());
	return {
		upcoming: schedule.filter(
			(game) => game.status === 'scheduled' && game.gameDate >= today
		),
		past: schedule
			.filter((game) => game.status !== 'scheduled' || game.gameDate < today)
			.reverse()
			.slice(0, 10)
	};
};
