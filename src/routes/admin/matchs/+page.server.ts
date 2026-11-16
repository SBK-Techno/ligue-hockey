import { redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { branding } from '#lib/generated/branding.ts';
import { can } from '#lib/domain/auth/policy.ts';
import { createGame, getGame, listSchedule } from '#lib/domain/games/service.ts';
import { listLocations } from '#lib/domain/locations/service.ts';
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

const PAST_LIMIT = 20;

function nextLeagueDay(): string {
	const today = todayInZone(branding.timezone, clock.nowMs());
	const weekday = dateOnlyToDate(today).getUTCDay();
	const days = weekday === 0 ? 7 : 7 - weekday;
	return addDays(today, days);
}

export const load: ServerLoad = ({ locals, url }) => {
	const actor = locals.actor;
	const settings = getSettings();
	const schedule = actor.kind === 'user' ? listSchedule(actor) : [];
	const locations =
		actor.kind === 'user' && can(actor, 'manageGames') ? listLocations(actor) : [];
	const today = todayInZone(branding.timezone, clock.nowMs());

	const upcoming = schedule.filter(
		(game) => game.gameDate >= today && game.status !== 'completed'
	);
	const past = schedule
		.filter((game) => game.gameDate < today || game.status === 'completed')
		.reverse();

	// Le dernier match sert de modèle : même lieu, même heure, zéro ressaisie.
	const last = schedule.at(-1);
	const defaultLocation =
		locations.find((location) => location.id === last?.locationId) ??
		locations.find((location) => location.name === settings['games.defaultLocation']) ??
		locations[0];
	const defaults = {
		date: nextLeagueDay(),
		locationId: defaultLocation?.id ?? '',
		time: last?.startTime ?? settings['games.defaultStartTime']
	};

	const showArchive = url.searchParams.get('archive') === '1';

	return {
		upcoming: upcoming.map((game) => getGame(actor, game.id)),
		past: (showArchive ? past : past.slice(0, PAST_LIMIT)).map((game) =>
			getGame(actor, game.id)
		),
		pastTotal: past.length,
		showArchive,
		locations,
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
