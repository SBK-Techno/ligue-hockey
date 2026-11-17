import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/server/db/index.ts', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite);
	migrate(db, { migrationsFolder: 'drizzle' });
	return { db, sqlite };
});

const { sqlite } = await import('#lib/server/db/index.ts');
const { playerSeasonStats } = await import('./queries.ts');

let gameDay = 0;

function insertGame(id: string, status: 'scheduled' | 'completed' | 'cancelled') {
	gameDay += 1;
	const date = `2026-11-${String(gameDay).padStart(2, '0')}`;
	sqlite
		.prepare(
			`insert into games (id, game_date, start_time, location_id, location, status, roster_template_json, created_at, updated_at)
			 values (?, ?, '20:00', 'arena', 'Aréna', ?, '{}', 0, 0)`
		)
		.run(id, date, status);
}

function insertSlot(id: string, gameId: string, playerId: string) {
	sqlite
		.prepare(
			`insert into game_slots (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values (?, ?, 'white', 'forward', 0, ?, 'regular', 0, 0)`
		)
		.run(id, gameId, playerId);
}

function insertGoal(
	id: string,
	gameId: string,
	kind: string,
	scorer: string,
	assist1: string | null = null,
	assist2: string | null = null
) {
	sqlite
		.prepare(
			`insert into game_goals (id, game_id, team, period, clock, kind, scorer_player_id, scorer_name, assist1_player_id, assist1_name, assist2_player_id, assist2_name, created_at, updated_at)
			 values (?, ?, 'white', 1, '10:00', ?, ?, 'Samuel Tremblay', ?, ?, ?, ?, 0, 0)`
		)
		.run(id, gameId, kind, scorer, assist1, assist1, assist2, assist2);
}

function insertPenalty(id: string, gameId: string, playerId: string) {
	sqlite
		.prepare(
			`insert into game_penalties (id, game_id, team, period, clock, player_id, player_name, infraction, minutes, coincidental, created_at, updated_at)
			 values (?, ?, 'white', 1, '10:00', ?, 'Samuel Tremblay', 'accrochage', 2, 0, 0, 0)`
		)
		.run(id, gameId, playerId);
}

beforeEach(() => {
	gameDay = 0;
	for (const table of [
		'game_goals',
		'game_penalties',
		'game_slots',
		'games',
		'locations',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('player', 'Samuel Tremblay', 'samuel@example.test', 1, 0, 0, 'player')`
		)
		.run();
	sqlite
		.prepare(
			`insert into players (user_id, first_name, last_name, position, age, is_substitute, active, created_at, updated_at)
			 values ('player', 'Samuel', 'Tremblay', 'forward', 30, 0, 1, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at) values ('arena', 'Aréna', 0, 0)`
		)
		.run();
});

describe('totaux de saison du joueur', () => {
	it('compte les buts, passes et pénalités des matchs terminés seulement', () => {
		insertGame('completed', 'completed');
		insertGame('scheduled', 'scheduled');
		insertSlot('slot-completed', 'completed', 'player');
		insertSlot('slot-scheduled', 'scheduled', 'player');
		insertGoal('goal-1', 'completed', 'even', 'player', 'player');
		insertGoal('goal-2', 'completed', 'power_play', 'player', 'player', 'player');
		insertGoal('goal-3', 'scheduled', 'even', 'player');
		insertPenalty('penalty-1', 'completed', 'player');
		insertPenalty('penalty-2', 'scheduled', 'player');

		expect(playerSeasonStats('player')).toEqual({
			games: 1,
			goals: 2,
			assists: 2,
			penalties: 1
		});
	});

	it('ne crédite jamais un but contre son camp au joueur', () => {
		insertGame('completed', 'completed');
		insertGoal('own', 'completed', 'own_goal', 'player');
		insertGoal('normal', 'completed', 'even', 'player');

		expect(playerSeasonStats('player').goals).toBe(1);
	});

	it('compte deux matchs terminés distincts', () => {
		insertGame('completed-1', 'completed');
		insertGame('completed-2', 'completed');
		insertSlot('slot-1', 'completed-1', 'player');
		insertSlot('slot-2', 'completed-2', 'player');

		expect(playerSeasonStats('player').games).toBe(2);
	});

	it('retourne des zéros pour un joueur sans match terminé', () => {
		expect(playerSeasonStats('player')).toEqual({
			games: 0,
			goals: 0,
			assists: 0,
			penalties: 0
		});
	});
});
