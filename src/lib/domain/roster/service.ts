import type { I18nKey } from '#config/i18n/fr.ts';
import type { Position } from '#config/positions.ts';
import { requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import {
	getGame,
	listSchedule,
	regenerateIfGenerated
} from '#lib/domain/games/service.ts';
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

export type RosterActionResult = {
	regenerated: boolean;
	warning?: I18nKey;
};

export type ClaimActionResult = ClaimResult & RosterActionResult;

export function listOpenRequests(actor: Actor): SubRequestWithGame[] {
	requireUser(actor);
	const games = new Map(listSchedule(actor).map((game) => [game.id, game]));
	return listOpenRequestsForMember(actor)
		.map((request) => {
			const game = games.get(request.gameId);
			return game ? { ...request, game } : null;
		})
		.filter((entry): entry is SubRequestWithGame => entry !== null);
}

export function listMyRequests(actor: Actor): SubRequestWithGame[] {
	requireUser(actor);
	const games = new Map(listSchedule(actor).map((game) => [game.id, game]));
	return listOwnSubRequests(actor)
		.map((request) => {
			const game = games.get(request.gameId);
			return game ? { ...request, game } : null;
		})
		.filter((entry): entry is SubRequestWithGame => entry !== null);
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
): SubRequestView {
	const game = getGame(actor, gameId);
	return createSubRequest(actor, game, position);
}

export function listSubstitutePool(actor: Actor): SubProfileView[] {
	return listSubstitutes(actor);
}
