import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { NOTIFICATION_CHANNEL_KEYS } from '#config/notification-channels.ts';
import { NOTIFICATION_EVENT_KEYS } from '#config/notification-events.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { players } from '#lib/domain/players/schema.ts';

const CHANNEL_SQL = NOTIFICATION_CHANNEL_KEYS.map((key) => `'${key}'`).join(', ');
const EVENT_SQL = NOTIFICATION_EVENT_KEYS.map((key) => `'${key}'`).join(', ');

export type NotificationJobStatus =
	| 'pending'
	| 'sending'
	| 'sent'
	| 'failed'
	| 'cancelled';

export const notificationJobs = sqliteTable(
	'notification_jobs',
	{
		id: text('id').primaryKey(),
		eventKey: text('event_key').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		channel: text('channel').notNull(),
		scheduledFor: integer('scheduled_for').notNull(),
		status: text('status')
			.$type<NotificationJobStatus>()
			.notNull()
			.default('pending'),
		payloadJson: text('payload_json').notNull(),
		dedupeKey: text('dedupe_key').notNull(),
		attempts: integer('attempts').notNull().default(0),
		lastError: text('last_error'),
		createdAt: integer('created_at').notNull(),
		sentAt: integer('sent_at'),
		claimedAt: integer('claimed_at'),
		readAt: integer('read_at')
	},
	(table) => [
		uniqueIndex('notification_jobs_dedupe_unique').on(table.dedupeKey),
		index('notification_jobs_due_idx').on(table.status, table.scheduledFor),
		index('notification_jobs_user_idx').on(table.userId, table.createdAt),
		index('notification_jobs_unread_idx')
			.on(table.userId)
			.where(
				sql`"channel" = 'in_app' and "status" = 'sent' and "read_at" is null`
			),
		check(
			'notification_jobs_channel_check',
			sql.raw(`"channel" in (${CHANNEL_SQL})`)
		),
		check(
			'notification_jobs_event_check',
			sql.raw(`"event_key" in (${EVENT_SQL})`)
		),
		check(
			'notification_jobs_claim_check',
			sql`(${table.status} = 'sending') = (${table.claimedAt} is not null)`
		),
		check(
			'notification_jobs_status_check',
			sql.raw(
				`"status" in ('pending', 'sending', 'sent', 'failed', 'cancelled')`
			)
		),
		check(
			'notification_jobs_payload_check',
			sql`json_valid(${table.payloadJson})`
		)
	]
);

export type NotificationJobRow = typeof notificationJobs.$inferSelect;

export const notificationPreferences = sqliteTable('notification_preferences', {
	playerId: text('player_id')
		.primaryKey()
		.references(() => players.userId, { onDelete: 'cascade' }),
	emailEnabled: integer('email_enabled', { mode: 'boolean' })
		.notNull()
		.default(true),
	pushEnabled: integer('push_enabled', { mode: 'boolean' })
		.notNull()
		.default(true),
	updatedAt: integer('updated_at').notNull()
});

export const pushSubscriptions = sqliteTable(
	'push_subscriptions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		userAgent: text('user_agent'),
		createdAt: integer('created_at').notNull(),
		lastUsedAt: integer('last_used_at'),
		failureCount: integer('failure_count').notNull().default(0)
	},
	(table) => [
		uniqueIndex('push_subscriptions_endpoint_unique').on(table.endpoint),
		index('push_subscriptions_user_idx').on(table.userId)
	]
);

export type NotificationPreferenceRow =
	typeof notificationPreferences.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
