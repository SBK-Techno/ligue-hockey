import { sql } from 'drizzle-orm';
import { check, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
	RATING_ATTRIBUTE_KEYS,
	RATING_SCALE,
	type RatingAttribute
} from '#config/rating-attributes.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { players } from '#lib/domain/players/schema.ts';

const ATTRIBUTE_SQL = RATING_ATTRIBUTE_KEYS.map((key) => `'${key}'`).join(', ');

export const playerRatings = sqliteTable(
	'player_ratings',
	{
		playerId: text('player_id')
			.notNull()
			.references(() => players.userId, { onDelete: 'cascade' }),
		attribute: text('attribute').$type<RatingAttribute>().notNull(),
		value: integer('value').notNull(),
		updatedAt: integer('updated_at').notNull(),
		updatedBy: text('updated_by').references(() => user.id, {
			onDelete: 'set null'
		})
	},
	(table) => [
		primaryKey({ columns: [table.playerId, table.attribute] }),
		check(
			'player_ratings_attribute_check',
			sql.raw(`"attribute" in (${ATTRIBUTE_SQL})`)
		),
		check(
			'player_ratings_value_check',
			sql.raw(
				`"value" between ${RATING_SCALE.min} and ${RATING_SCALE.max}`
			)
		)
	]
);

export type PlayerRatingRow = typeof playerRatings.$inferSelect;
