import type { ServerLoad } from '@sveltejs/kit';
import { listSchedule } from '#lib/domain/games/service.ts';
import { nextGameId, splitSchedule } from '#lib/domain/games/schedule.ts';
import { listGameScores } from '#lib/domain/gamesheet/service.ts';

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') return { upcoming: [], past: [], nextId: null };

	const schedule = listSchedule(actor);
	const { upcoming, past } = splitSchedule(schedule);
	// Le score des matchs passés vient du même lecteur que l'agenda de l'accueil.
	const scores = listGameScores(actor, past.map((game) => game.id));
	return {
		upcoming,
		past: past.map((game) => ({ ...game, score: scores.get(game.id) ?? null })),
		nextId: nextGameId(schedule)
	};
};
