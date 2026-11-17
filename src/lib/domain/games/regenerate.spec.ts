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
const { regenerateGame } = await import('./service.ts');
const { regenerateUpcomingGeneratedGames } = await import('./upcoming.ts');

const actor: Actor = {
	kind: 'user',
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

const snapshot = JSON.stringify({
	skillDiff: 0,
	ageDiff: 0,
	sizeDiff: 0,
	warnings: [],
	ruleViolations: [],
	bench: [],
	candidateKey: '',
	generatedAt: 1
});

function captureError(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	throw new Error('expected an error');
}

beforeEach(() => {
	for (const table of [
		'game_player_ratings',
		'game_slots',
		'games',
		'locations',
		'players',
		'audit_log',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('admin', 'Admin', 'admin@example.test', 1, 0, 0, 'admin')`
		)
		.run();
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('player', 'Joueur', 'player@example.test', 1, 0, 0, 'player')`
		)
		.run();
	sqlite
		.prepare(
			`insert into players (user_id, first_name, last_name, position, age, is_substitute, active, created_at, updated_at)
			 values ('player', 'Jean', 'Test', 'forward', 30, 0, 1, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at) values ('arena', 'Aréna', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into games (id, game_date, start_time, location_id, location, status, roster_template_json, generated_at, generation_json, created_at, updated_at)
			 values ('started', '2020-01-05', '09:00', 'arena', 'Aréna', 'scheduled', '{}', 1, ?, 0, 0)`
		)
		.run(snapshot);
	sqlite
		.prepare(
			`insert into game_slots (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values ('slot', 'started', 'white', 'forward', 0, 'player', 'regular', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into game_player_ratings (game_id, player_id, attribute, value, updated_at)
			 values ('started', 'player', 'impact', 4, 0)`
		)
		.run();
});

describe('regeneration policy', () => {
	it('refuses a game that already started and keeps its ratings', () => {
		const error = captureError(() => regenerateGame('started', actor));

		expect(error).toMatchObject({ code: 'CONFLICT', key: 'games.lineupLocked' });
		const ratings = sqlite
			.prepare("select count(*) as count from game_player_ratings where game_id = 'started'")
			.get() as { count: number };
		expect(ratings.count).toBe(1);
	});

	it('does not try to recalculate a started game in the background', () => {
		expect(regenerateUpcomingGeneratedGames()).toEqual({ regenerated: 0, failed: 0 });
	});
});
