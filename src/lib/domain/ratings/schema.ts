import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text
} from 'drizzle-orm/sqlite-core';
import {
	GAME_RATING_KEYS,
	POSITION_RATING_KEYS,
	RATING_ATTRIBUTE_KEYS,
	RATING_SCALE,
	type GameRatingAttribute,
	type PositionRatingAttribute,
	type RatingAttribute
} from '#config/rating-attributes.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { games } from '#lib/domain/games/schema.ts';
import { players } from '#lib/domain/players/schema.ts';

const SEASON_ATTRIBUTE_SQL = [...RATING_ATTRIBUTE_KEYS, ...POSITION_RATING_KEYS]
	.map((key) => `'${key}'`)
	.join(', ');
const GAME_ATTRIBUTE_SQL = GAME_RATING_KEYS.map((key) => `'${key}'`).join(', ');

export const playerRatings = sqliteTable(
	'player_ratings',
	{
		playerId: text('player_id')
			.notNull()
			.references(() => players.userId, { onDelete: 'cascade' }),
		attribute: text('attribute')
			.$type<RatingAttribute | PositionRatingAttribute>()
			.notNull(),
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
			sql.raw(`"attribute" in (${SEASON_ATTRIBUTE_SQL})`)
		),
		check(
			'player_ratings_value_check',
			sql.raw(
				`"value" between ${RATING_SCALE.min} and ${RATING_SCALE.max}`
			)
		)
	]
);

export const gamePlayerRatings = sqliteTable(
	'game_player_ratings',
	{
		gameId: text('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		playerId: text('player_id')
			.notNull()
			.references(() => players.userId, { onDelete: 'cascade' }),
		attribute: text('attribute').$type<GameRatingAttribute>().notNull(),
		value: integer('value').notNull(),
		updatedAt: integer('updated_at').notNull(),
		updatedBy: text('updated_by').references(() => user.id, {
			onDelete: 'set null'
		})
	},
	(table) => [
		primaryKey({ columns: [table.gameId, table.playerId, table.attribute] }),
		check(
			'game_player_ratings_attribute_check',
			sql.raw(`"attribute" in (${GAME_ATTRIBUTE_SQL})`)
		),
		check(
			'game_player_ratings_value_check',
			sql.raw(
				`"value" between ${RATING_SCALE.min} and ${RATING_SCALE.max}`
			)
		),
		index('game_player_ratings_player_idx').on(table.playerId)
	]
);

export type PlayerRatingRow = typeof playerRatings.$inferSelect;
export type GamePlayerRatingRow = typeof gamePlayerRatings.$inferSelect;
