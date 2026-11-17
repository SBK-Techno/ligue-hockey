import type { Actor } from '#lib/domain/auth/types.ts';
import { db, type DbExecutor } from '#lib/server/db/index.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { insertAudit, type AuditEntry } from './queries.ts';

export type AuditAction = {
	action: string;
	entityType: string;
	entityId?: string | null;
	metadata?: Record<string, unknown>;
};

/** Construit l'entrée pour qu'une transaction puisse l'écrire elle-même. */
export function auditEntry(actor: Actor, entry: AuditAction): AuditEntry {
	return {
		actorUserId: actor.kind === 'user' ? actor.userId : null,
		action: entry.action,
		entityType: entry.entityType,
		entityId: entry.entityId ?? null,
		metadataJson: entry.metadata ? JSON.stringify(entry.metadata) : null,
		createdAt: clock.nowMs()
	};
}

/**
 * Écrit l'audit dans l'exécuteur du service appelant. Un service qui possède
 * déjà une transaction lui passe son exécuteur : la mutation et sa trace
 * réussissent ou échouent ensemble.
 */
export function recordAudit(
	actor: Actor,
	entry: AuditAction,
	executor: DbExecutor = db
): void {
	insertAudit(auditEntry(actor, entry), executor);
}
