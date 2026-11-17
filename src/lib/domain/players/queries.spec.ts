import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Supprimer un remplaçant ne rouvre sa place que sur un match qui n'a pas
 * encore commencé. Le jour seul ne suffit pas : un match de 9 h est passé à
 * 20 h le même jour.
 */

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
const { deletePlayerAccount } = await import('./queries.ts');

const TEMPLATE = JSON.stringify({
	goaliesPerTeam: 0,
	forwardsPerTeam: 2,
	defensePerTeam: 0
});

function user(id: string): void {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values (?, ?, ?, 1, 0, 0, 'player')`
		)
		.run(id, id, `${id}@example.test`);
}

function player(id: string): void {
	user(id);
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, is_substitute, active, created_at, updated_at)
			 values (?, ?, 'Test', 'forward', 30, ?, 1, 0, 0)`
		)
		.run(id, id, id === 'sub' ? 1 : 0);
}

function game(id: string, date: string, status: 'scheduled' | 'completed'): void {
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, completed_at,
			  roster_template_json, created_at, updated_at)
			 values (?, ?, '09:00', 'arena', 'Aréna', ?, ?, ?, 0, 0)`
		)
		.run(id, date, status, status === 'completed' ? 1 : null, TEMPLATE);
}

function request(id: string, gameId: string, filler: string, status = 'filled'): void {
	sqlite
		.prepare(
			`insert into sub_requests
			 (id, game_id, requested_by_player_id, position, reason, status, created_at, filled_by_player_id, filled_at)
			 values (?, ?, 'req', 'forward', 'absence', ?, 0, ?, 1)`
		)
		.run(id, gameId, status, filler);
}

beforeEach(() => {
	for (const table of ['sub_requests', 'games', 'locations', 'players', 'user']) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	sqlite
		.prepare(`insert into locations (id, name, created_at, updated_at) values ('arena', 'Aréna', 0, 0)`)
		.run();
	player('req');
	player('sub');
	game('today-morning', '2026-11-16', 'scheduled');
	game('tomorrow', '2026-11-17', 'scheduled');
	game('past', '2026-11-15', 'completed');
	request('r1', 'today-morning', 'sub');
	request('r2', 'tomorrow', 'sub');
	request('r3', 'past', 'sub');
});

describe('suppression d’un remplaçant', () => {
	it('ne rouvre pas une place sur un match déjà commencé le même jour', () => {
		deletePlayerAccount('sub', '2026-11-16', '20:00');

		const rows = sqlite
			.prepare('select id, status from sub_requests order by id')
			.all() as { id: string; status: string }[];

		expect(rows).toEqual([
			{ id: 'r1', status: 'cancelled' },
			{ id: 'r2', status: 'open' },
			{ id: 'r3', status: 'cancelled' }
		]);
	});
});
