import type { Position } from '#config/positions.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { auditEntry } from '#lib/domain/audit/service.ts';
import { insertAudit } from '#lib/domain/audit/queries.ts';
import { isGameStarted } from '#lib/domain/games/playability.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';
import { AppError } from '#lib/shared/errors.ts';
import { newId } from '#lib/shared/ids/id.ts';
import type { DbExecutor } from '#lib/server/db/index.ts';
import {
	cancelOpenRequests,
	cancelRequest,
	findRequesterRequest,
	insertRequest,
	listClaimedSubs
} from './queries.ts';
import type { SubRequestRow } from './schema.ts';

/**
 * Lecture et fermeture des remplaçants au moment de générer, annuler ou
 * terminer un match. Ce module reste sans dépendance vers les services de
 * matchs ou de joueurs pour que le recalcul automatique ne crée pas de cycle
 * d'importation.
 */
export function claimsForGeneration(gameId: string) {
	return listClaimedSubs(gameId).filter(
		(row): row is { playerId: string; position: Position; filledAt: number | null; requestId: string } =>
			row.playerId !== null
	);
}

/**
 * Ferme les demandes d'un match dans la transaction de l'appelant. L'audit
 * rejoint la même transaction : une fermeture ne peut pas réussir sans sa
 * trace. La garde de permission appartient à l'appelant, ce geste étant un
 * effet de l'annulation ou de la fin du match, pas une action de gestion.
 */
export function closeRequestsForGame(
	actor: Actor,
	gameId: string,
	at: number,
	executor: DbExecutor,
	reason: 'cancelled' | 'finalized'
): number {
	const count = cancelOpenRequests(gameId, at, executor);
	if (count > 0) {
		insertAudit(
			auditEntry(actor, {
				action: 'sub.requests_cancelled',
				entityType: 'game',
				entityId: gameId,
				metadata: { count, reason }
			}),
			executor
		);
	}
	return count;
}

export type AbsenceRequester = {
	userId: string;
	position: Position;
	isSubstitute: boolean;
};

/**
 * Crée la demande d'absence dans la transaction de l'appelant. La demande et
 * sa trace réussissent ou échouent ensemble; l'avis part après la validation.
 */
export function createAbsenceRequestIn(
	executor: DbExecutor,
	actor: Actor,
	game: GameSummary,
	player: AbsenceRequester,
	at: number
): { request: SubRequestRow; created: boolean } | null {
	if (player.isSubstitute) return null;
	if (isGameStarted(game, at)) {
		throw new AppError('CONFLICT', { key: 'availability.gameClosed' });
	}

	const existing = findRequesterRequest(game.id, player.userId, executor);
	if (existing) return { request: existing, created: false };

	const request: SubRequestRow = {
		id: newId('sub'),
		gameId: game.id,
		requestedByPlayerId: player.userId,
		createdByUserId: actor.kind === 'user' ? actor.userId : null,
		position: player.position,
		reason: 'absence',
		status: 'open',
		createdAt: at,
		filledByPlayerId: null,
		filledAt: null,
		cancelledAt: null
	};
	insertRequest(request, executor);
	insertAudit(
		auditEntry(actor, {
			action: 'sub.request_created',
			entityType: 'sub_request',
			entityId: request.id,
			metadata: { gameId: game.id, position: player.position, reason: 'absence' }
		}),
		executor
	);
	return { request, created: true };
}

/**
 * Annule la demande d'un joueur qui revient présent, dans la transaction de
 * l'appelant. La place du remplaçant est libérée par l'appelant qui possède
 * l'alignement; l'avis de retrait part après la validation.
 */
export function cancelRequestForReturnIn(
	executor: DbExecutor,
	actor: Actor,
	game: GameSummary,
	playerId: string,
	at: number
): { request: SubRequestRow; bumpedPlayerId: string | null } | null {
	const request = findRequesterRequest(game.id, playerId, executor);
	if (!request) return null;
	if (!cancelRequest(request.id, at, executor)) return null;
	insertAudit(
		auditEntry(actor, {
			action: 'sub.request_cancelled',
			entityType: 'sub_request',
			entityId: request.id,
			metadata: { reason: 'regular-returned', playerId }
		}),
		executor
	);
	return { request, bumpedPlayerId: request.filledByPlayerId };
}
