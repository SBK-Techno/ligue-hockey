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
const { listPlayerGameRatings } = await import('./queries.ts');

beforeEach(() => {
	sqlite.prepare('delete from game_player_ratings').run();
	sqlite.prepare('delete from game_slots').run();
	sqlite.prepare('delete from games').run();
	sqlite.prepare('delete from locations').run();
	sqlite.prepare('delete from players').run();
	sqlite.prepare('delete from user').run();
	for (const id of ['player', 'other']) {
		sqlite
			.prepare(
				`insert into user (id, name, email, email_verified, created_at, updated_at, role)
				 values (?, ?, ?, 1, 0, 0, 'player')`
			)
			.run(id, id, `${id}@example.test`);
		sqlite
			.prepare(
				`insert into players (user_id, first_name, last_name, position, age, is_substitute, active, created_at, updated_at)
				 values (?, 'Jean', 'Test', 'forward', 30, 0, 1, 0, 0)`
			)
			.run(id);
	}
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at) values ('arena', 'Aréna', 0, 0)`
		)
		.run();
	for (const [id, date] of [
		['played', '2026-11-08'],
		['left', '2026-11-09']
	]) {
		sqlite
			.prepare(
				`insert into games (id, game_date, start_time, location_id, location, status, roster_template_json, created_at, updated_at)
				 values (?, ?, '09:00', 'arena', 'Aréna', 'scheduled', '{}', 0, 0)`
			)
			.run(id, date);
	}
	sqlite
		.prepare(
			`insert into game_slots (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values ('slot-played', 'played', 'white', 'forward', 0, 'player', 'regular', 0, 0)`
		)
		.run();
	// Le joueur a été retiré de « left » : la place est libre, la note reste.
	sqlite
		.prepare(
			`insert into game_slots (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values ('slot-left', 'left', 'white', 'forward', 0, null, null, 0, 0)`
		)
		.run();
	for (const [gameId, value] of [
		['played', 4],
		['left', 1]
	]) {
		sqlite
			.prepare(
				`insert into game_player_ratings (game_id, player_id, attribute, value, updated_at)
				 values (?, 'player', 'impact', ?, 0)`
			)
			.run(gameId, value);
	}
});

describe('listPlayerGameRatings', () => {
	it('excludes a game the player was removed from', () => {
		const rows = listPlayerGameRatings('player');

		expect(rows.map((row) => row.gameId)).toEqual(['played']);
	});

	it('keeps the rating of a game the player still plays', () => {
		sqlite
			.prepare(
				`update game_slots set assigned_player_id = 'player', assignment_kind = 'regular'
				 where id = 'slot-left'`
			)
			.run();

		expect(listPlayerGameRatings('player').map((row) => row.gameId).sort()).toEqual([
			'left',
			'played'
		]);
	});
});
