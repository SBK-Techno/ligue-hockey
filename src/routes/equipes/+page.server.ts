import { redirect } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';
import { listSchedule } from '#lib/domain/games/service.ts';
import { scheduleView } from '#lib/domain/games/schedule.ts';

export const load: ServerLoad = ({ locals }) => {
	if (locals.actor.kind !== 'user') return {};
	const { defaultId } = scheduleView(listSchedule(locals.actor));
	if (defaultId) redirect(303, `/equipes/${defaultId}`);
	return {};
};
