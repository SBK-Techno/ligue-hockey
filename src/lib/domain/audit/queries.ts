import { newId } from '#lib/shared/ids/id.ts';
import { db } from '#lib/server/db/index.ts';
import { auditLog } from './schema.ts';

export type AuditEntry = {
	actorUserId: string | null;
	action: string;
	entityType: string;
	entityId: string | null;
	metadataJson: string | null;
	createdAt: number;
};

export function insertAudit(entry: AuditEntry): void {
	db.insert(auditLog)
		.values({ id: newId('audit'), ...entry })
		.run();
}
