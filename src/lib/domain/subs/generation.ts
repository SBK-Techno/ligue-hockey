import type { Position } from '#config/positions.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import { auditEntry } from '#lib/domain/audit/service.ts';
import { insertAudit } from '#lib/domain/audit/queries.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';
import type { DbExecutor } from '#lib/server/db/index.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { cancelOpenRequests, listClaimedSubs } from './queries.ts';

/**
 * Lecture et fermeture des remplaçants au moment de générer ou de terminer un
 * match. Ce module reste sans dépendance vers les services de matchs ou de
 * joueurs pour que le recalcul automatique ne crée pas de cycle d'importation.
 */
export function claimsForGeneration(gameId: string) {
	return listClaimedSubs(gameId).filter(
		(row): row is { playerId: string; position: Position; filledAt: number | null; requestId: string } =>
			row.playerId !== null
	);
}

export function cancelAllForGame(actor: Actor, game: GameSummary): number {
	requirePermission(actor, 'manageSubs');
	const count = cancelOpenRequests(game.id, clock.nowMs());
	if (count > 0) {
		insertAudit(
			auditEntry(actor, {
				action: 'sub.requests_cancelled',
				entityType: 'game',
				entityId: game.id,
				metadata: { count }
			})
		);
	}
	return count;
}

/**
 * Ferme les demandes ouvertes et comblées dans la transaction de
 * finalisation du match. La garde de permission appartient à l'appelant :
 * ce geste est un effet de la fin du match, pas une action de gestion.
 */
export function closeRequestsOnFinalize(
	actor: Actor,
	gameId: string,
	at: number,
	executor: DbExecutor
): number {
	const count = cancelOpenRequests(gameId, at, executor);
	if (count > 0) {
		insertAudit(
			auditEntry(actor, {
				action: 'sub.requests_cancelled',
				entityType: 'game',
				entityId: gameId,
				metadata: { count, reason: 'finalized' }
			}),
			executor
		);
	}
	return count;
}
