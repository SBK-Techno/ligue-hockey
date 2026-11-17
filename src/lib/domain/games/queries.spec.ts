import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Les écritures de cycle de vie portent leur condition dans le WHERE. Un
 * finalize, une édition ou une annulation concurrente ne doit jamais écraser
 * l'état qu'un autre gestionnaire vient d'écrire.
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
const { cancelGame, completeGame, updateGame } = await import('./queries.ts');
const { cancelOpenRequests } = await import('../subs/queries.ts');

const AUDIT = {
	actorUserId: null,
	action: 'game.cancel',
	entityType: 'game',
	entityId: 'g1',
	metadataJson: null,
	createdAt: 0
};

const TEMPLATE = JSON.stringify({
	goaliesPerTeam: 1,
	forwardsPerTeam: 3,
	defensePerTeam: 2
});

function game(id: string, status: 'scheduled' | 'completed'): void {
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, completed_at,
			  roster_template_json, created_at, updated_at)
			 values (?, '2026-11-22', '09:00', 'arena', 'Aréna', ?, ?, ?, 1, 1)`
		)
		.run(id, status, status === 'completed' ? 1 : null, TEMPLATE);
}

beforeEach(() => {
	sqlite.prepare('delete from audit_log').run();
	sqlite.prepare('delete from sub_requests').run();
	sqlite.prepare('delete from games').run();
	sqlite.prepare('delete from locations').run();
	sqlite
		.prepare(`insert into locations (id, name, created_at, updated_at) values ('arena', 'Aréna', 0, 0)`)
		.run();
});

describe('écritures conditionnelles d’un match', () => {
	it('ferme une demande comblée à la fin du match en gardant le remplaçant', () => {
		game('g1', 'scheduled');
		sqlite
			.prepare(
				`insert into user (id, name, email, email_verified, created_at, updated_at, role)
				 values ('filler', 'Remplaçant', 'filler@example.test', 1, 0, 0, 'player')`
			)
			.run();
		sqlite
			.prepare(
				`insert into players (user_id, first_name, last_name, position, age, active, created_at, updated_at)
				 values ('filler', 'Remplaçant', 'Test', 'forward', 30, 1, 0, 0)`
			)
			.run();
		sqlite
			.prepare(
				`insert into sub_requests
				 (id, game_id, position, reason, status, created_at, filled_by_player_id, filled_at)
				 values ('request', 'g1', 'forward', 'absence', 'filled', 1, 'filler', 2)`
			)
			.run();

		expect(completeGame('g1', 5, AUDIT, (tx) => cancelOpenRequests('g1', 5, tx))).toBe(true);

		expect(
			sqlite
				.prepare("select status, filled_by_player_id from sub_requests where id = 'request'")
				.get()
		).toEqual({ status: 'cancelled', filled_by_player_id: 'filler' });
	});

	it('annule un match programmé une seule fois', () => {
		game('g1', 'scheduled');

		expect(cancelGame('g1', 2, AUDIT)).toBe(true);
		expect(cancelGame('g1', 3, AUDIT)).toBe(false);
	});

	it('refuse d’annuler un match terminé', () => {
		game('g2', 'completed');

		expect(cancelGame('g2', 2, AUDIT)).toBe(false);
	});

	it('modifie seulement la révision lue', () => {
		game('g3', 'scheduled');

		expect(updateGame('g3', { notes: 'Neuf' }, 2, 999)).toBe(false);
		expect(updateGame('g3', { notes: 'Neuf' }, 2, 1)).toBe(true);
	});

	it('refuse de modifier un match qui n’est plus programmé', () => {
		game('g4', 'completed');

		expect(updateGame('g4', { notes: 'Tard' }, 2, 1)).toBe(false);
	});
});
