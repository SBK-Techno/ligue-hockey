import { sql } from 'drizzle-orm';
import {
	check,
	integer,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { user } from '#lib/server/db/auth.schema.ts';
import { players } from '#lib/domain/players/schema.ts';

export type PairRuleKind = 'must' | 'must_not';

export const pairRules = sqliteTable(
	'pair_rules',
	{
		id: text('id').primaryKey(),
		playerAId: text('player_a_id')
			.notNull()
			.references(() => players.userId, { onDelete: 'cascade' }),
		playerBId: text('player_b_id')
			.notNull()
			.references(() => players.userId, { onDelete: 'cascade' }),
		kind: text('kind').$type<PairRuleKind>().notNull(),
		createdAt: integer('created_at').notNull(),
		createdBy: text('created_by').references(() => user.id, {
			onDelete: 'set null'
		})
	},
	(table) => [
		uniqueIndex('pair_rules_pair_unique').on(table.playerAId, table.playerBId),
		check('pair_rules_order_check', sql`${table.playerAId} < ${table.playerBId}`),
		check(
			'pair_rules_kind_check',
			sql.raw(`"kind" in ('must', 'must_not')`)
		)
	]
);

export type PairRuleRow = typeof pairRules.$inferSelect;
