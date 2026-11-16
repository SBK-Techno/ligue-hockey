import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from '#lib/server/db/auth.schema.ts';

export const auditLog = sqliteTable(
	'audit_log',
	{
		id: text('id').primaryKey(),
		actorUserId: text('actor_user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		action: text('action').notNull(),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id'),
		metadataJson: text('metadata_json'),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('audit_log_created_idx').on(table.createdAt),
		index('audit_log_entity_idx').on(table.entityType, table.entityId)
	]
);

export type AuditLogRow = typeof auditLog.$inferSelect;
