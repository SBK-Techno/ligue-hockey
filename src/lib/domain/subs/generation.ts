import type { Position } from '#config/positions.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { cancelOpenRequests, listClaimedSubs } from './queries.ts';

/**
 * Lecture et fermeture des remplaçants au moment de générer un match. Ce
 * module reste sans dépendance vers les services de matchs ou de joueurs pour
 * que le recalcul automatique ne crée pas de cycle d'importation.
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
		recordAudit(actor, {
			action: 'sub.requests_cancelled',
			entityType: 'game',
			entityId: game.id,
			metadata: { count }
		});
	}
	return count;
}
