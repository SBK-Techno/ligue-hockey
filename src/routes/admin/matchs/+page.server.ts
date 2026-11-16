import { redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { branding } from '#lib/generated/branding.ts';
import {
	createGame,
	getGame,
	listSchedule
} from '#lib/domain/games/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { actionError } from '#lib/server/action.ts';
import {
	addDays,
	clock,
	dateOnlyToDate,
	todayInZone
} from '#lib/shared/time/clock.ts';
import { parseForm } from '#lib/shared/validation.ts';
import { gameInputSchema } from '#lib/domain/games/validators.ts';

function nextLeagueDay(): string {
	const today = todayInZone(branding.timezone, clock.nowMs());
	const weekday = dateOnlyToDate(today).getUTCDay();
	const days = weekday === 0 ? 7 : 7 - weekday;
	return addDays(today, days);
}

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	const settings = getSettings();
	const defaults = {
		date: nextLeagueDay(),
		location: settings['games.defaultLocation'],
		time: settings['games.defaultStartTime']
	};
	if (actor.kind !== 'user') {
		return { games: [], defaults };
	}
	return {
		games: listSchedule(actor)
			.slice(0, 20)
			.map((game) => getGame(actor, game.id)),
		defaults
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		try {
			const parsed = parseForm(gameInputSchema, await request.formData());
			const created = createGame(locals.actor, parsed);
			redirect(303, `/admin/matchs/${created.id}`);
		} catch (cause) {
			return actionError(cause);
		}
	}
};
