import { describe, expect, it, vi } from 'vitest';

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

function plan(sql: string): string {
	return (
		sqlite.prepare(`explain query plan ${sql}`).all() as { detail: string }[]
	)
		.map((row) => row.detail)
		.join(' | ');
}

describe('index des lectures de saison', () => {
	it.each([
		['game_goals_scorer_idx', `select * from game_goals where scorer_player_id = 'p'`],
		['game_goals_assist1_idx', `select * from game_goals where assist1_player_id = 'p'`],
		['game_goals_assist2_idx', `select * from game_goals where assist2_player_id = 'p'`],
		['game_penalties_player_idx', `select * from game_penalties where player_id = 'p'`],
		['game_slots_assigned_player_idx', `select * from game_slots where assigned_player_id = 'p'`]
	])('utilise %s', (index, sql) => {
		expect(plan(sql)).toContain(index);
	});
});
