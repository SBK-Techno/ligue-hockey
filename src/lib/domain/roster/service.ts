import type { I18nKey } from '#config/i18n/fr.ts';
import type { Position } from '#config/positions.ts';
import { requirePermission, requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import {
	getGame,
	listSchedule,
	regenerateIfGenerated
} from '#lib/domain/games/service.ts';
import { isGameStarted } from '#lib/domain/games/playability.ts';
import { splitSchedule } from '#lib/domain/games/schedule.ts';
import { compareOpenRequests } from '#lib/domain/subs/policy.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';
import {
	cancelRequestByAdmin as cancelSubRequest,
	claimSubstitute as claimSubRequest,
	createManualRequest as createSubRequest,
	listGameRequests,
	listMyRequests as listOwnSubRequests,
	listOpenRequestsForMember,
	listSubstitutes,
	releaseSubstitute as releaseSubRequest,
	type ClaimResult,
	type SubProfileView,
	type SubRequestView,
	type WaveSchedule
} from '#lib/domain/subs/service.ts';

export type SubRequestWithGame = SubRequestView & {
	game: GameSummary;
};

export type RequestableGame = Pick<
	GameSummary,
	'id' | 'gameDate' | 'startTime' | 'location'
>;

export type RosterActionResult = {
	regenerated: boolean;
	warning?: I18nKey;
};

export type ClaimActionResult = ClaimResult & RosterActionResult;

function withGames(
	requests: readonly SubRequestView[],
	schedule: readonly GameSummary[]
): SubRequestWithGame[] {
	const games = new Map(schedule.map((game) => [game.id, game]));
	return requests
		.map((request) => {
			const game = games.get(request.gameId);
			return game ? { ...request, game } : null;
		})
		.filter((entry): entry is SubRequestWithGame => entry !== null);
}

/**
 * Le schedule est déjà chargé par l'appelant quand la page le possède. La
 * valeur par défaut garde l'API simple pour les autres surfaces.
 */
export function listOpenRequests(
	actor: Actor,
	schedule: readonly GameSummary[] = listSchedule(actor)
): SubRequestWithGame[] {
	requireUser(actor);
	// Une place ouverte sur un match commencé ne se réclame plus : la demande
	// reste en base pour l'historique, mais elle quitte le bassin visible.
	return withGames(listOpenRequestsForMember(actor), schedule)
		.filter((entry) => !isGameStarted(entry.game))
		.sort(compareOpenRequests);
}

export function listMyRequests(
	actor: Actor,
	schedule: readonly GameSummary[] = listSchedule(actor)
): SubRequestWithGame[] {
	requireUser(actor);
	return withGames(listOwnSubRequests(actor), schedule);
}

export function listRequestsForGame(
	actor: Actor,
	gameId: string
): SubRequestView[] {
	const game = getGame(actor, gameId);
	return listGameRequests(actor, game);
}

export function claimSubstitute(
	actor: Actor,
	gameId: string,
	requestId: string
): ClaimActionResult {
	const game = getGame(actor, gameId);
	const claim = claimSubRequest(actor, game, requestId);
	const regeneration = regenerateIfGenerated(gameId);
	return {
		...claim,
		regenerated: regeneration.regenerated,
		...(regeneration.warning ? { warning: regeneration.warning } : {})
	};
}

export function releaseSubstitute(
	actor: Actor,
	gameId: string,
	requestId: string
): WaveSchedule & RosterActionResult {
	const game = getGame(actor, gameId);
	const waves = releaseSubRequest(actor, game, requestId);
	const regeneration = regenerateIfGenerated(gameId);
	return {
		...waves,
		regenerated: regeneration.regenerated,
		...(regeneration.warning ? { warning: regeneration.warning } : {})
	};
}

export function cancelRequest(
	actor: Actor,
	gameId: string,
	requestId: string
): { bumpedPlayerId: string | null } & RosterActionResult {
	const game = getGame(actor, gameId);
	const bumpedPlayerId = cancelSubRequest(actor, game, requestId);
	const regeneration = regenerateIfGenerated(gameId);
	return {
		bumpedPlayerId,
		regenerated: regeneration.regenerated,
		...(regeneration.warning ? { warning: regeneration.warning } : {})
	};
}

export function createManualRequest(
	actor: Actor,
	gameId: string,
	position: Position
): SubRequestView & RosterActionResult {
	const game = getGame(actor, gameId);
	const request = createSubRequest(actor, game, position);
	const regeneration = regenerateIfGenerated(gameId);
	return {
		...request,
		regenerated: regeneration.regenerated,
		...(regeneration.warning ? { warning: regeneration.warning } : {})
	};
}

export function listSubstitutePool(actor: Actor): SubProfileView[] {
	return listSubstitutes(actor);
}

/**
 * Les matchs qu'une demande manuelle peut viser : à venir et encore
 * programmés. La liste reste réservée aux gestionnaires des remplaçants.
 */
export function listRequestableGames(actor: Actor): RequestableGame[] {
	requirePermission(actor, 'manageSubs');
	return splitSchedule(listSchedule(actor))
		.upcoming.filter((game) => game.status === 'scheduled')
		.map(({ id, gameDate, startTime, location }) => ({
			id,
			gameDate,
			startTime,
			location
		}));
}
