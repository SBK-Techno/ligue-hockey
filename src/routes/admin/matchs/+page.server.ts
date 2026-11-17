import { redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { branding } from '#lib/generated/branding.ts';
import { can } from '#lib/domain/auth/policy.ts';
import { createGame, listGameListEntries, listSchedule } from '#lib/domain/games/service.ts';
import {
	defaultGameDraft,
	nextGameId,
	splitSchedule
} from '#lib/domain/games/schedule.ts';
import { listLocations } from '#lib/domain/locations/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { actionError } from '#lib/server/action.ts';
import { todayInZone } from '#lib/shared/time/clock.ts';
import { parseForm } from '#lib/shared/validation.ts';
import { gameInputSchema } from '#lib/domain/games/validators.ts';

const PAST_LIMIT = 20;

export const load: ServerLoad = ({ locals, url }) => {
	const actor = locals.actor;
	const settings = getSettings();
	const schedule = actor.kind === 'user' ? listSchedule(actor) : [];
	const locations =
		actor.kind === 'user' && can(actor, 'manageGames') ? listLocations(actor) : [];
	const today = todayInZone(branding.timezone);

	const { upcoming, past } = splitSchedule(schedule);
	const defaults = defaultGameDraft({
		games: schedule,
		locations,
		defaultLocationName: settings['games.defaultLocation'],
		defaultStartTime: settings['games.defaultStartTime'],
		today
	});

	const showArchive = url.searchParams.get('archive') === '1';
	const pastPage = showArchive ? past : past.slice(0, PAST_LIMIT);
	const entries = listGameListEntries(actor, [
		...upcoming.map((game) => game.id),
		...pastPage.map((game) => game.id)
	]);

	return {
		upcoming: upcoming.map((game) => entries.get(game.id) ?? game),
		past: pastPage.map((game) => entries.get(game.id) ?? game),
		pastTotal: past.length,
		nextId: nextGameId(schedule),
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
