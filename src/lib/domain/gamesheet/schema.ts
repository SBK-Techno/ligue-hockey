import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	sqliteTable,
	text
} from 'drizzle-orm/sqlite-core';
import { GOAL_KIND_KEYS, type GoalKind } from '#config/goal-kinds.ts';
import {
	INFRACTION_KEYS,
	PENALTY_MINUTES,
	type InfractionKey
} from '#config/infractions.ts';
import { PERIOD_NUMBERS } from '#config/periods.ts';
import {
	GAME_CLOCK_GLOB,
	GAME_CLOCK_MAX,
	GAME_CLOCK_MIN
} from '#config/time.ts';
import { TEAM_KEYS, type Team } from '#config/teams.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { games } from '#lib/domain/games/schema.ts';
import { players } from '#lib/domain/players/schema.ts';

const TEAM_SQL = TEAM_KEYS.map((key) => `'${key}'`).join(', ');
const INFRACTION_SQL = INFRACTION_KEYS.map((key) => `'${key}'`).join(', ');
const MINUTES_SQL = PENALTY_MINUTES.join(', ');
const PERIOD_SQL = PERIOD_NUMBERS.join(', ');

export { GOAL_KIND_KEYS, GOAL_KINDS, goalKindDefinition } from '#config/goal-kinds.ts';
export type { GoalKind } from '#config/goal-kinds.ts';

const GOAL_KIND_SQL = GOAL_KIND_KEYS.map((key) => `'${key}'`).join(', ');

export const gameGoals = sqliteTable(
	'game_goals',
	{
		id: text('id').primaryKey(),
		gameId: text('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		team: text('team').$type<Team>().notNull(),
		period: integer('period').notNull(),
		clock: text('clock').notNull(),
		kind: text('kind').$type<GoalKind>().notNull(),
		scorerPlayerId: text('scorer_player_id').references(() => players.userId, {
			onDelete: 'set null'
		}),
		scorerName: text('scorer_name').notNull(),
		scorerNumber: integer('scorer_number'),
		assist1PlayerId: text('assist1_player_id').references(() => players.userId, {
			onDelete: 'set null'
		}),
		assist1Name: text('assist1_name'),
		assist1Number: integer('assist1_number'),
		assist2PlayerId: text('assist2_player_id').references(() => players.userId, {
			onDelete: 'set null'
		}),
		assist2Name: text('assist2_name'),
		assist2Number: integer('assist2_number'),
		createdAt: integer('created_at').notNull(),
		createdBy: text('created_by').references(() => user.id, {
			onDelete: 'set null'
		}),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [
		index('game_goals_game_team_idx').on(table.gameId, table.team),
		index('game_goals_scorer_idx').on(table.scorerPlayerId),
		index('game_goals_assist1_idx').on(table.assist1PlayerId),
		index('game_goals_assist2_idx').on(table.assist2PlayerId),
		check('game_goals_team_check', sql.raw(`"team" in (${TEAM_SQL})`)),
		check('game_goals_period_check', sql.raw(`"period" in (${PERIOD_SQL})`)),
		check(
			'game_goals_clock_check',
			sql`${table.clock} glob '${sql.raw(GAME_CLOCK_GLOB)}' and ${table.clock} between '${sql.raw(GAME_CLOCK_MIN)}' and '${sql.raw(GAME_CLOCK_MAX)}'`
		),
		check('game_goals_kind_check', sql.raw(`"kind" in (${GOAL_KIND_SQL})`)),
		check(
			'game_goals_assists_check',
			sql`${table.assist2Name} is null or ${table.assist1Name} is not null`
		)
	]
);

export const gamePenalties = sqliteTable(
	'game_penalties',
	{
		id: text('id').primaryKey(),
		gameId: text('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		team: text('team').$type<Team>().notNull(),
		period: integer('period').notNull(),
		clock: text('clock').notNull(),
		playerId: text('player_id').references(() => players.userId, {
			onDelete: 'set null'
		}),
		playerName: text('player_name').notNull(),
		playerNumber: integer('player_number'),
		infraction: text('infraction').$type<InfractionKey>().notNull(),
		minutes: integer('minutes').notNull(),
		coincidental: integer('coincidental', { mode: 'boolean' })
			.notNull()
			.default(false),
		createdAt: integer('created_at').notNull(),
		createdBy: text('created_by').references(() => user.id, {
			onDelete: 'set null'
		}),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [
		index('game_penalties_game_team_idx').on(table.gameId, table.team),
		index('game_penalties_player_idx').on(table.playerId),
		check('game_penalties_team_check', sql.raw(`"team" in (${TEAM_SQL})`)),
		check('game_penalties_period_check', sql.raw(`"period" in (${PERIOD_SQL})`)),
		check(
			'game_penalties_clock_check',
			sql`${table.clock} glob '${sql.raw(GAME_CLOCK_GLOB)}' and ${table.clock} between '${sql.raw(GAME_CLOCK_MIN)}' and '${sql.raw(GAME_CLOCK_MAX)}'`
		),
		check(
			'game_penalties_infraction_check',
			sql.raw(`"infraction" in (${INFRACTION_SQL})`)
		),
		check(
			'game_penalties_minutes_check',
			sql.raw(`"minutes" in (${MINUTES_SQL})`)
		),
		check(
			'game_penalties_coincidental_check',
			sql`${table.coincidental} in (0, 1)`
		)
	]
);

export type GameGoalRow = typeof gameGoals.$inferSelect;
export type NewGameGoalRow = typeof gameGoals.$inferInsert;
export type GamePenaltyRow = typeof gamePenalties.$inferSelect;
export type NewGamePenaltyRow = typeof gamePenalties.$inferInsert;
