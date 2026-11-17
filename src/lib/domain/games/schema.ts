import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { TEAM_KEYS, type Team } from '#config/teams.ts';
import { POSITION_KEYS, type Position } from '#config/positions.ts';
import { DATE_GLOB, TIME_GLOB } from '#config/time.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { players } from '#lib/domain/players/schema.ts';
import { locations } from '#lib/domain/locations/schema.ts';

const TEAM_SQL = TEAM_KEYS.map((key) => `'${key}'`).join(', ');
const POSITION_SQL = POSITION_KEYS.map((key) => `'${key}'`).join(', ');

export type GameStatus = 'scheduled' | 'cancelled' | 'completed';
export type AssignmentKind = 'regular' | 'sub';

export const games = sqliteTable(
	'games',
	{
		id: text('id').primaryKey(),
		gameDate: text('game_date').notNull(),
		startTime: text('start_time').notNull(),
		locationId: text('location_id')
			.notNull()
			.references(() => locations.id, { onDelete: 'restrict' }),
		/** Libellé figé du lieu au moment de la création ou du changement de lieu. */
		location: text('location').notNull(),
		notes: text('notes'),
		status: text('status').$type<GameStatus>().notNull().default('scheduled'),
		/** Un match n'est terminé qu'avec cette estampille, jamais par le statut seul. */
		completedAt: integer('completed_at'),
		/** Alignement enregistré à la main : la régénération automatique ne le remplace pas. */
		lineupManualAt: integer('lineup_manual_at'),
		rosterTemplateJson: text('roster_template_json').notNull(),
		generatedAt: integer('generated_at'),
		generationJson: text('generation_json'),
		createdBy: text('created_by').references(() => user.id, {
			onDelete: 'set null'
		}),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [
		uniqueIndex('games_schedule_unique')
			.on(table.gameDate, table.startTime)
			.where(sql`"status" <> 'cancelled'`),
		index('games_status_date_idx').on(table.status, table.gameDate),
		index('games_location_idx').on(table.locationId),
		check(
			'games_status_check',
			sql.raw(`"status" in ('scheduled', 'cancelled', 'completed')`)
		),
		check(
			'games_date_format',
			sql`${table.gameDate} glob '${sql.raw(DATE_GLOB)}'`
		),
		check(
			'games_time_format',
			sql`${table.startTime} glob '${sql.raw(TIME_GLOB)}'`
		),
		check(
			'games_roster_json',
			sql`json_valid(${table.rosterTemplateJson})`
		),
		check(
			'games_generation_json',
			sql`${table.generationJson} is null or json_valid(${table.generationJson})`
		),
		check(
			'games_generation_state',
			sql`(${table.generatedAt} is null) = (${table.generationJson} is null)`
		)
	]
);

export const gameSlots = sqliteTable(
	'game_slots',
	{
		id: text('id').primaryKey(),
		gameId: text('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		team: text('team').$type<Team>().notNull(),
		position: text('position').$type<Position>().notNull(),
		slotIndex: integer('slot_index').notNull(),
		assignedPlayerId: text('assigned_player_id').references(() => players.userId, {
			onDelete: 'restrict'
		}),
		assignmentKind: text('assignment_kind').$type<AssignmentKind>(),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [
		uniqueIndex('game_slots_slot_unique').on(
			table.gameId,
			table.team,
			table.position,
			table.slotIndex
		),
		uniqueIndex('game_slots_player_unique').on(
			table.gameId,
			table.assignedPlayerId
		),
		index('game_slots_assigned_player_idx').on(table.assignedPlayerId),
		check('game_slots_team_check', sql.raw(`"team" in (${TEAM_SQL})`)),
		check(
			'game_slots_position_check',
			sql.raw(`"position" in (${POSITION_SQL})`)
		),
		check(
			'game_slots_kind_check',
			sql.raw(`"assignment_kind" is null or "assignment_kind" in ('regular', 'sub')`)
		),
		check(
			'game_slots_assignment_check',
			sql`(${table.assignedPlayerId} is null) = (${table.assignmentKind} is null)`
		)
	]
);

export type GameRow = typeof games.$inferSelect;
export type GameSlotRow = typeof gameSlots.$inferSelect;

export type AvailabilityStatus = 'present' | 'absent';

export const gameAvailability = sqliteTable(
	'game_availability',
	{
		gameId: text('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		playerId: text('player_id')
			.notNull()
			.references(() => players.userId, { onDelete: 'cascade' }),
		status: text('status').$type<AvailabilityStatus>().notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.gameId, table.playerId] }),
		check(
			'game_availability_status_check',
			sql.raw(`"status" in ('present', 'absent')`)
		)
	]
);

export type GameAvailabilityRow = typeof gameAvailability.$inferSelect;
