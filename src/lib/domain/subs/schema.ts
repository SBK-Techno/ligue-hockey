import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { user } from '#lib/server/db/auth.schema.ts';
import { POSITION_KEYS, type Position } from '#config/positions.ts';
import { games } from '#lib/domain/games/schema.ts';
import { players } from '#lib/domain/players/schema.ts';

const POSITION_SQL = POSITION_KEYS.map((key) => `'${key}'`).join(', ');

export type SubRequestStatus = 'open' | 'filled' | 'cancelled';
export type SubRequestReason = 'absence' | 'manual' | 'shortfall';

export const subProfiles = sqliteTable(
	'sub_profiles',
	{
		playerId: text('player_id')
			.primaryKey()
			.references(() => players.userId, { onDelete: 'cascade' }),
		favorite: integer('favorite', { mode: 'boolean' })
			.notNull()
			.default(false),
		positionsJson: text('positions_json').notNull(),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [
		check(
			'sub_profiles_positions_json_check',
			sql`json_valid(${table.positionsJson}) and json_type(${table.positionsJson}) = 'array'`
		)
	]
);

export const subRequests = sqliteTable(
	'sub_requests',
	{
		id: text('id').primaryKey(),
		gameId: text('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		requestedByPlayerId: text('requested_by_player_id').references(
			() => players.userId,
			{ onDelete: 'restrict' }
		),
		createdByUserId: text('created_by_user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		position: text('position').$type<Position>().notNull(),
		reason: text('reason').$type<SubRequestReason>().notNull(),
		status: text('status').$type<SubRequestStatus>().notNull(),
		createdAt: integer('created_at').notNull(),
		filledByPlayerId: text('filled_by_player_id').references(
			() => players.userId,
			{ onDelete: 'restrict' }
		),
		filledAt: integer('filled_at'),
		cancelledAt: integer('cancelled_at')
	},
	(table) => [
		index('sub_requests_game_status_idx').on(table.gameId, table.status),
		index('sub_requests_position_idx').on(table.gameId, table.position),
		index('sub_requests_status_idx').on(table.status, table.createdAt),
		uniqueIndex('sub_requests_requester_unique')
			.on(table.gameId, table.requestedByPlayerId)
			.where(
				sql`"requested_by_player_id" is not null and "status" <> 'cancelled'`
			),
		uniqueIndex('sub_requests_filler_unique')
			.on(table.gameId, table.filledByPlayerId)
			.where(sql`"filled_by_player_id" is not null`),
		check(
			'sub_requests_position_check',
			sql.raw(`"position" in (${POSITION_SQL})`)
		),
		check(
			'sub_requests_reason_check',
			sql.raw(`"reason" in ('absence', 'manual', 'shortfall')`)
		),
		check(
			'sub_requests_status_check',
			sql.raw(`"status" in ('open', 'filled', 'cancelled')`)
		),
		check(
			'sub_requests_filled_state',
			// Une demande annulée peut garder son remplaçant : c'est la trace
			// historique d'une place comblée avant la fin du match.
			sql`(${table.status} = 'cancelled') or ((${table.status} = 'filled') = (${table.filledByPlayerId} is not null))`
		),
		check(
			'sub_requests_cancelled_state',
			sql`(${table.status} = 'cancelled') = (${table.cancelledAt} is not null)`
		)
	]
);

export type SubProfileRow = typeof subProfiles.$inferSelect;
export type SubRequestRow = typeof subRequests.$inferSelect;
