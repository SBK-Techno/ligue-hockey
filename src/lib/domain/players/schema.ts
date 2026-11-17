import { sql } from 'drizzle-orm';
import { PLAYER_LIMITS } from '#config/players.ts';
import {
	check,
	integer,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { POSITION_KEYS, type Position } from '#config/positions.ts';
import { user } from '#lib/server/db/auth.schema.ts';

const POSITION_SQL = POSITION_KEYS.map((key) => `'${key}'`).join(', ');

export const players = sqliteTable(
	'players',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		firstName: text('first_name').notNull(),
		lastName: text('last_name').notNull(),
		position: text('position').$type<Position>().notNull(),
		age: integer('age').notNull(),
		jerseyNumber: integer('jersey_number'),
		avatarId: text('avatar_id'),
		isSubstitute: integer('is_substitute', { mode: 'boolean' }).notNull().default(false),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		/**
		 * Une fiche supprimée reste en base pour que le grand livre et les
		 * feuilles de match gardent leur histoire. Elle n'apparaît plus dans
		 * les listes et ne peut plus redevenir active.
		 */
		deletedAt: integer('deleted_at'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [
		/** Un joueur actif porte toujours une identité, et une seule fois. */
		uniqueIndex('players_active_avatar_unique')
			.on(table.avatarId)
			.where(sql`"active" = 1 and "avatar_id" is not null`),
		/** Un numéro de chandail appartient à un seul joueur actif. */
		uniqueIndex('players_active_jersey_unique')
			.on(table.jerseyNumber)
			.where(sql`"active" = 1 and "jersey_number" is not null`),
		check('players_position_check', sql.raw(`"position" in (${POSITION_SQL})`)),
		check(
			'players_age_check',
			sql`${table.age} >= ${sql.raw(String(PLAYER_LIMITS.ageMin))} and ${table.age} <= ${sql.raw(String(PLAYER_LIMITS.ageMax))}`
		)
	]
);

export type PlayerRow = typeof players.$inferSelect;
export type NewPlayerRow = typeof players.$inferInsert;
