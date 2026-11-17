import { auditEntry } from '#lib/domain/audit/service.ts';
import type { Actor } from '#lib/domain/auth/types.ts';

/**
 * La purge des notes d'un match est la même trace pour la génération, le
 * comblement et l'alignement manuel : un seul constructeur, donc un renommage
 * ne peut pas dériver sur un chemin.
 */
export function ratingsRemovedAudit(
	actor: Actor,
	gameId: string,
	playerIds: readonly string[]
) {
	return auditEntry(actor, {
		action: 'ratings.game_removed',
		entityType: 'game',
		entityId: gameId,
		metadata: { playerIds }
	});
}
