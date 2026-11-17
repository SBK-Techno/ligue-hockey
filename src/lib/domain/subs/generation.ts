import type { Position } from '#config/positions.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { auditEntry } from '#lib/domain/audit/service.ts';
import { insertAudit } from '#lib/domain/audit/queries.ts';
import type { DbExecutor } from '#lib/server/db/index.ts';
import { cancelOpenRequests, listClaimedSubs } from './queries.ts';

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
