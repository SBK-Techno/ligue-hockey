import type { ServerLoad } from '@sveltejs/kit';
import { listSchedule } from '#lib/domain/games/service.ts';
import { nextGameId, splitSchedule } from '#lib/domain/games/schedule.ts';

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') return { upcoming: [], past: [], nextId: null };

	const schedule = listSchedule(actor);
	const { upcoming, past } = splitSchedule(schedule);
	return {
		upcoming,
		past: past.reverse(),
		nextId: nextGameId(schedule)
	};
};
