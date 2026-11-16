import { sql } from 'drizzle-orm';
import {
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { user } from '#lib/server/db/auth.schema.ts';

export type ChatMessageKind = 'text' | 'poll';

export const chatMessages = sqliteTable(
	'chat_messages',
	{
		id: text('id').primaryKey(),
		authorUserId: text('author_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: text('kind').$type<ChatMessageKind>().notNull(),
		body: text('body'),
		createdAt: integer('created_at').notNull(),
		deletedAt: integer('deleted_at'),
		deletedBy: text('deleted_by').references(() => user.id, {
			onDelete: 'set null'
		})
	},
	(table) => [
		index('chat_messages_created_idx').on(table.createdAt),
		check(
			'chat_messages_kind_check',
			sql.raw(`"kind" in ('text', 'poll')`)
		),
		check(
			'chat_messages_body_check',
			sql`(${table.kind} = 'text' and ${table.body} is not null) or (${table.kind} = 'poll' and ${table.body} is null)`
		)
	]
);

export const polls = sqliteTable('polls', {
	messageId: text('message_id')
		.primaryKey()
		.references(() => chatMessages.id, { onDelete: 'cascade' }),
	question: text('question').notNull(),
	closesAt: integer('closes_at'),
	createdAt: integer('created_at').notNull()
});

export const pollOptions = sqliteTable(
	'poll_options',
	{
		id: text('id').primaryKey(),
		messageId: text('message_id')
			.notNull()
			.references(() => polls.messageId, { onDelete: 'cascade' }),
		label: text('label').notNull(),
		optionIndex: integer('option_index').notNull()
	},
	(table) => [
		uniqueIndex('poll_options_order_unique').on(
			table.messageId,
			table.optionIndex
		),
		uniqueIndex('poll_options_message_key_unique').on(
			table.id,
			table.messageId
		)
	]
);

export const pollVotes = sqliteTable(
	'poll_votes',
	{
		messageId: text('message_id')
			.notNull()
			.references(() => chatMessages.id, { onDelete: 'cascade' }),
		optionId: text('option_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.messageId, table.userId] }),
		index('poll_votes_option_idx').on(table.optionId),
		foreignKey({
			name: 'poll_votes_option_message_fk',
			columns: [table.optionId, table.messageId],
			foreignColumns: [pollOptions.id, pollOptions.messageId]
		}).onDelete('cascade')
	]
);

export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type PollRow = typeof polls.$inferSelect;
export type PollOptionRow = typeof pollOptions.$inferSelect;
export type PollVoteRow = typeof pollVotes.$inferSelect;
