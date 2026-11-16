import type { Actions, ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { markAvailability, getAvailability } from '#lib/domain/availability/service.ts';
import { listChat } from '#lib/domain/chat/service.ts';
import { getMyBalance } from '#lib/domain/finance/service.ts';
import { getGame, listSchedule } from '#lib/domain/games/service.ts';
import { nextGameId, splitSchedule } from '#lib/domain/games/schedule.ts';
import { listOpenRequests } from '#lib/domain/roster/service.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const availabilitySchema = z.object({
	gameId: z.string().min(1),
	status: z.enum(['present', 'absent'])
});

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') {
		return {
			games: [],
			game: null,
			availability: null,
			balance: null,
			openRequests: [],
			chat: []
		};
	}

	const schedule = listSchedule(actor);
	const { upcoming } = splitSchedule(schedule);
	const nextId = nextGameId(schedule);
	const next = nextId ? (upcoming.find((game) => game.id === nextId) ?? null) : null;
	const game = next ? getGame(actor, next.id) : null;
	const availability = next ? getAvailability(actor, next.id) : null;
	const openRequests = listOpenRequests(actor);

	return {
		games: upcoming,
		game,
		availability,
		balance: getMyBalance(actor),
		openRequests,
		chat: listChat(actor).slice(0, 3)
	};
};

export const actions: Actions = {
	availability: async ({ request, locals }) => {
		try {
			const parsed = parseForm(availabilitySchema, await request.formData());
			const result = markAvailability(locals.actor, parsed.gameId, parsed.status);
			return {
				ok: true,
				message: t(result.warning ?? result.messageKey)
			};
		} catch (cause) {
			return actionError(cause);
		}
	}
};
