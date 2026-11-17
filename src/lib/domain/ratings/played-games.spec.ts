import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';

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
const { playedGamesForAssessment } = await import('./service.ts');

const admin: Actor = {
	kind: 'user',
	active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

function seedGames(count: number): void {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('admin', 'Admin', 'admin@example.test', 1, 0, 0, 'admin')`
		)
		.run();
	sqlite
		.prepare(
			`insert into players (user_id, first_name, last_name, position, age, jersey_number, created_at, updated_at)
			 values ('admin', 'Admin', 'Test', 'forward', 30, 10, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at)
			 values ('loc', 'Aréna test', 0, 0)`
		)
		.run();

	for (let index = 0; index < count; index += 1) {
		const id = `game-${index}`;
		const day = String(1 + (index % 28)).padStart(2, '0');
		const month = String(1 + Math.floor(index / 28)).padStart(2, '0');
		sqlite
			.prepare(
				`insert into games
				 (id, game_date, start_time, location_id, location, status, roster_template_json,
				  generated_at, generation_json, created_at, updated_at)
				 values (?, ?, '09:00', 'loc', 'Aréna test', 'completed', '{}', 1, '{}', 0, 0)`
			)
			.run(id, `2026-${month}-${day}`);
		sqlite
			.prepare(
				`insert into game_slots
				 (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
				 values (?, ?, 'white', 'forward', 0, 'admin', 'regular', 0, 0)`
			)
			.run(`${id}-slot`, id);
	}
}

function counted<T>(read: () => T): { value: T; statements: number } {
	const original = sqlite.prepare.bind(sqlite);
	let statements = 0;
	(sqlite as unknown as { prepare: typeof original }).prepare = ((sql: string) => {
		statements += 1;
		return original(sql);
	}) as typeof original;
	try {
		return { value: read(), statements };
	} finally {
		(sqlite as unknown as { prepare: typeof original }).prepare = original;
	}
}

beforeEach(() => {
	for (const table of [
		'game_player_ratings',
		'game_slots',
		'games',
		'locations',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
});

describe('matchs à évaluer', () => {
	it('borne le nombre de requêtes, quel que soit le nombre de matchs', () => {
		seedGames(30);

		const small = counted(() => playedGamesForAssessment(admin, 10));
		const large = counted(() => playedGamesForAssessment(admin, 8));

		expect(small.value).toHaveLength(10);
		expect(large.value).toHaveLength(8);
		expect(small.statements).toBe(3);
		expect(large.statements).toBe(small.statements);
		expect(large.value.every((game) => game.players === 1)).toBe(true);
	});
});
