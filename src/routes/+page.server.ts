import type { Actions, ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { branding } from '#lib/generated/branding.ts';
import { availabilityForGame, markAvailability } from '#lib/domain/availability/service.ts';
import { can } from '#lib/domain/auth/policy.ts';
import {
	castPollVote,
	listChat,
	type ChatMessageView,
	type ChatPollView
} from '#lib/domain/chat/service.ts';
import { voteInputSchema } from '#lib/domain/chat/validators.ts';
import { getMyBalance } from '#lib/domain/finance/service.ts';
import { getGame, listSchedule } from '#lib/domain/games/service.ts';
import { nextGameId, splitSchedule } from '#lib/domain/games/schedule.ts';
import { buildMonthCalendar } from '#lib/domain/home/calendar.ts';
import {
	composeHome,
	type HomeComposition,
	type HomeCompositionInput
} from '#lib/domain/home/composition.ts';
import {
	playedGamesForAssessment,
	type PlayedGameAssessment
} from '#lib/domain/ratings/service.ts';
import {
	claimSubstitute,
	listMyRequests,
	listOpenRequests,
	type SubRequestWithGame
} from '#lib/domain/roster/service.ts';
import { cancelOwnRequest } from '#lib/domain/subs/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { getMySubProfile } from '#lib/domain/subs/service.ts';
import { subRequestRefSchema } from '#lib/domain/subs/validators.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { todayInZone } from '#lib/shared/time/clock.ts';
import { parseForm } from '#lib/shared/validation.ts';

const availabilitySchema = z.object({
	gameId: z.string().min(1),
	status: z.enum(['present', 'absent'])
});

type OpenPollView = {
	messageId: string;
	poll: ChatPollView;
	unvoted: boolean;
};

type ManagerSummary = {
	openSlots: number;
	present: number;
	absent: number;
	unknown: number;
	generated: boolean;
};

function openPollIn(messages: readonly ChatMessageView[]): OpenPollView | null {
	let fallback: OpenPollView | null = null;
	for (const message of messages) {
		if (!message.poll || message.poll.closed) continue;
		const view = {
			messageId: message.id,
			poll: message.poll,
			unvoted: message.poll.options.every((option) => !option.myVote)
		};
		if (view.unvoted) return view;
		fallback ??= view;
	}
	return fallback;
}

function ownRequestIn(
	requests: readonly SubRequestWithGame[],
	gameId: string
): SubRequestWithGame | null {
	const forGame = requests.filter(
		(request) => request.gameId === gameId && request.status !== 'cancelled'
	);
	return (
		forGame.find((request) => request.status === 'open') ??
		forGame.find((request) => request.status === 'filled') ??
		null
	);
}

export const load: ServerLoad = async ({ locals, parent }) => {
	const actor = locals.actor;
	const settings = getSettings();
	const seasonLabel = settings['league.seasonLabel'];

	if (actor.kind !== 'user') {
		return {
			board: null,
			game: null,
			calendar: null,
			nextGames: [],
			availability: null,
			balance: null,
			ownSlot: null,
			ownBench: null,
			ownRequest: null,
			panelClaims: [],
			panelOwnRequest: null,
			claimable: [],
			openPoll: null,
			latestMessage: null,
			evaluationGame: null,
			managerSummary: null,
			isManager: false,
			seasonLabel
		};
	}

	const { hasPlayerProfile, isSubstitute } = await parent();
	const canManageGames = can(actor, 'manageGames');
	const canEditRatings = can(actor, 'editRatings');
	const canClaimSubs = can(actor, 'claimSubs');

	const schedule = listSchedule(actor);
	const { upcoming } = splitSchedule(schedule);
	// Un match annulé ne cache jamais le suivant, mais s'il ne reste que lui,
	// l'accueil doit le montrer comme annulé plutôt que comme une absence de match.
	const nextId =
		nextGameId(schedule) ??
		upcoming.find((entry) => entry.status === 'cancelled')?.id ??
		null;
	const game = nextId ? getGame(actor, nextId) : null;
	const today = todayInZone(branding.timezone);
	const calendar = buildMonthCalendar({
		games: schedule,
		today,
		nextGameDate: game?.gameDate ?? null
	});

	// La feuille de présence est partagée par les membres du match; le
	// gestionnaire en a aussi besoin pour son bandeau. Aucune évaluation ni
	// aucun solde étranger n'entre dans cette réponse.
	const availability =
		game && (hasPlayerProfile || canManageGames) ? availabilityForGame(actor, game) : null;
	const balance = hasPlayerProfile ? getMyBalance(actor) : null;

	const ownSlot =
		hasPlayerProfile && game
			? (game.slots.find((slot) => slot.player?.playerId === actor.userId) ?? null)
			: null;
	const ownBench =
		hasPlayerProfile && game
			? (game.generation?.bench.find((entry) => entry.playerId === actor.userId) ?? null)
			: null;

	const myRequests =
		hasPlayerProfile && game
			? listMyRequests(actor, schedule).filter(
					(request) => request.requestedByPlayerId === actor.userId
				)
			: [];
	const ownRequest = game ? ownRequestIn(myRequests, game.id) : null;
	const ownRequestOpen = ownRequest?.status === 'open';

	const positions =
		isSubstitute && canClaimSubs ? getMySubProfile(actor).positions : [];
	const openRequests =
		isSubstitute && canClaimSubs && game ? listOpenRequests(actor, schedule) : [];
	const claimable =
		game && isSubstitute
			? openRequests.filter(
					(request) =>
						request.gameId === game.id &&
						request.requestedByPlayerId !== actor.userId &&
						positions.includes(request.position)
				)
			: [];

	const chat = hasPlayerProfile ? listChat(actor) : [];
	const openPoll = openPollIn(chat);
	const latestMessage = chat.find((message) => !message.deleted) ?? null;

	const evaluations =
		canEditRatings && hasPlayerProfile ? playedGamesForAssessment(actor) : [];
	const evaluationGame: PlayedGameAssessment | null =
		evaluations.find((entry) => !entry.complete) ?? null;

	const nextGames = upcoming.filter((entry) => entry.id !== game?.id).slice(0, 3);
	const managerSummary: ManagerSummary | null =
		canManageGames && game && availability
			? {
					openSlots: game.openSlots,
					present: availability.present,
					absent: availability.absent,
					unknown: availability.unknown,
					generated: game.generated
				}
			: null;

	const input: HomeCompositionInput = {
		hasPlayerProfile,
		isSubstitute,
		canManageGames,
		canEditRatings,
		hasGame: game !== null,
		gameToday: game !== null && game.status === 'scheduled' && game.gameDate === today,
		gameStatus: game?.status ?? null,
		availability: availability
			? {
					own: availability.own,
					canRespond: availability.canRespond,
					canWithdraw: availability.canWithdraw
				}
			: null,
		teamsGenerated: game?.generated ?? false,
		ownSlot: ownSlot !== null,
		ownRequestOpen,
		claimableCount: claimable.length,
		balance: balance
			? { outstandingCents: balance.outstandingCents, isOverdue: balance.isOverdue }
			: null,
		evaluationsPending: evaluationGame !== null,
		openPoll: openPoll ? { unvoted: openPoll.unvoted } : null,
		latestMessage: latestMessage !== null,
		otherUpcomingGames: nextGames.length
	};
	const board: HomeComposition = composeHome(input);
	const actioned = new Set(board.actions.map((action) => action.kind));

	return {
		board,
		game,
		calendar,
		nextGames,
		availability,
		balance,
		ownSlot,
		ownBench,
		ownRequest,
		// Une place déjà offerte dans les actions ne se répète pas dans le panneau.
		panelClaims: actioned.has('claim') ? claimable.slice(1) : claimable,
		panelOwnRequest: actioned.has('own-request') ? null : ownRequest,
		claimable,
		openPoll,
		latestMessage,
		evaluationGame,
		managerSummary,
		isManager: canManageGames,
		seasonLabel
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
	},
	vote: async ({ request, locals }) => {
		try {
			const parsed = parseForm(voteInputSchema, await request.formData());
			castPollVote(locals.actor, parsed);
			return { ok: true, message: t('chat.voteSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	claim: async ({ request, locals }) => {
		try {
			const parsed = parseForm(subRequestRefSchema, await request.formData());
			const result = claimSubstitute(locals.actor, parsed.gameId, parsed.requestId);
			return {
				ok: true,
				message: t(result.warning ?? 'subs.claimed')
			};
		} catch (cause) {
			return actionError(cause);
		}
	},
	cancelRequest: async ({ request, locals }) => {
		try {
			const parsed = parseForm(subRequestRefSchema, await request.formData());
			const game = getGame(locals.actor, parsed.gameId);
			cancelOwnRequest(locals.actor, game, parsed.requestId);
			return { ok: true, message: t('subs.requestCancelled') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
