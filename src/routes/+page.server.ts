import type { Actions, ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { mapUrlFor } from '#config/maps.ts';
import { teamDefinition } from '#config/teams.ts';
import { branding } from '#lib/generated/branding.ts';
import {
	availabilityForGame,
	markAvailability,
	myAvailabilityByGame
} from '#lib/domain/availability/service.ts';
import { can } from '#lib/domain/auth/policy.ts';
import {
	castPollVote,
	listChatSummary
} from '#lib/domain/chat/service.ts';
import { voteInputSchema } from '#lib/domain/chat/validators.ts';
import { getMyBalance } from '#lib/domain/finance/service.ts';
import { getGame, listSchedule } from '#lib/domain/games/service.ts';
import { scheduleView } from '#lib/domain/games/schedule.ts';
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
import { listGameScores } from '#lib/domain/gamesheet/service.ts';
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

type ManagerSummary = {
	openSlots: number;
	present: number;
	absent: number;
	unknown: number;
	generated: boolean;
};

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
			agenda: { upcoming: [], past: [] },
			nextGames: [],
			gameMapUrl: null,
			ownTeamLabel: null,
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
	const { upcoming, past, nextId } = scheduleView(schedule);
	// Un match annulé ne cache jamais le suivant, mais s'il ne reste que lui,
	// l'accueil doit le montrer comme annulé plutôt que comme une absence de match.
	// Hors saison, l'accueil ne promeut jamais le dernier match joué en « prochain ».
	const game = nextId ? getGame(actor, nextId) : null;
	const today = todayInZone(branding.timezone);

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
	// Le héros ne connaît ni la table des matières ni celle des équipes : les
	// libellés sont résolus une fois, côté serveur, avec les autres surfaces.
	const gameMapUrl = game ? mapUrlFor(game.locationAddress, game.locationMapUrl) : null;
	const ownTeamLabel = ownSlot ? t(teamDefinition(ownSlot.team).labelKey) : null;
	const ownBenchTeamLabel = ownBench?.team
		? t(teamDefinition(ownBench.team).labelKey)
		: null;

	const myRequests = hasPlayerProfile
		? listMyRequests(actor, schedule).filter(
				(request) => request.requestedByPlayerId === actor.userId
			)
		: [];
	const ownRequest = game ? ownRequestIn(myRequests, game.id) : null;
	const ownRequestOpen = ownRequest?.status === 'open';
	const requestGameIds = new Set(
		myRequests
			.filter((request) => request.status === 'open')
			.map((request) => request.gameId)
	);

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

	const chat = hasPlayerProfile
		? listChatSummary(actor)
		: { openPoll: null, latestMessage: null };
	const { openPoll, latestMessage } = chat;

	const evaluations =
		canEditRatings && hasPlayerProfile ? playedGamesForAssessment(actor) : [];
	const evaluationGame: PlayedGameAssessment | null =
		evaluations.find((entry) => !entry.complete) ?? null;

	const nextGames = upcoming.filter((entry) => entry.id !== game?.id).slice(0, 3);

	// L'agenda de saison : les matchs qui suivent la tête, puis les derniers
	// résultats. Le match de la tête n'est jamais répété dans la liste.
	const agendaUpcoming = upcoming.filter((entry) => entry.id !== game?.id).slice(0, 4);
	const agendaPast = past.slice(0, 3);
	const agendaIds = [...agendaUpcoming, ...agendaPast].map((entry) => entry.id);
	const myAvailability = hasPlayerProfile
		? myAvailabilityByGame(actor, agendaIds)
		: new Map();
	// Le score est un fait public du match : même un compte sans fiche joueur
	// (administration, responsable) le voit. Seule la réponse personnelle
	// dépend de la fiche.
	const pastScores = listGameScores(actor, agendaPast.map((entry) => entry.id));
	const agenda = {
		upcoming: agendaUpcoming.map((entry) => ({
			...entry,
			availability: myAvailability.get(entry.id) ?? null,
			requestOpen: requestGameIds.has(entry.id)
		})),
		past: agendaPast.map((entry) => ({
			...entry,
			availability: myAvailability.get(entry.id) ?? null,
			score: pastScores.get(entry.id) ?? null
		}))
	};
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
		agenda,
		nextGames,
		gameMapUrl,
		ownTeamLabel,
		ownBenchTeamLabel,
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
