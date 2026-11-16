import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const locations = sqliteTable(
	'locations',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		address: text('address'),
		mapUrl: text('map_url'),
		notes: text('notes'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [uniqueIndex('locations_name_unique').on(table.name)]
);

export type LocationRow = typeof locations.$inferSelect;
