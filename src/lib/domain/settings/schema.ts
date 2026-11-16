import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { SETTINGS_KEYS } from '#config/settings-registry.ts';
import { user } from '#lib/server/db/auth.schema.ts';

const KEY_SQL = SETTINGS_KEYS.map((key) => `'${key}'`).join(', ');

export const leagueSettings = sqliteTable(
	'league_settings',
	{
		key: text('key').primaryKey(),
		valueJson: text('value_json').notNull(),
		updatedAt: integer('updated_at').notNull(),
		updatedBy: text('updated_by').references(() => user.id, {
			onDelete: 'set null'
		})
	},
	(table) => [
		check('league_settings_key_check', sql.raw(`"key" in (${KEY_SQL})`)),
		check('league_settings_value_json', sql`json_valid(${table.valueJson})`)
	]
);

export type LeagueSettingRow = typeof leagueSettings.$inferSelect;
