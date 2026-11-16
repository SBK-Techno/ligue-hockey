import { db, type DbExecutor } from '#lib/server/db/index.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { auditLog } from './schema.ts';

export type AuditEntry = {
	actorUserId: string | null;
	action: string;
	entityType: string;
	entityId: string | null;
	metadataJson: string | null;
	createdAt: number;
};

/**
 * Écrit une entrée d'audit. Un appelant qui possède déjà une transaction lui
 * passe son exécuteur pour que l'écriture de l'action et celle de l'audit
 * réussissent ou échouent ensemble.
 */
export function insertAudit(entry: AuditEntry, executor: DbExecutor = db): void {
	executor
		.insert(auditLog)
		.values({ id: newId('audit'), ...entry })
		.run();
}
