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
const { cancelGame } = await import('./service.ts');

const manager: Actor = {
	kind: 'user',
	active: true,
	userId: 'manager',
	name: 'Gérant',
	role: 'manager'
};

function captureError(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	throw new Error('expected an error');
}

beforeEach(() => {
	sqlite.prepare('drop trigger if exists fail_requests').run();
	for (const table of [
		'notification_jobs',
		'sub_requests',
		'games',
		'locations',
		'audit_log',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('manager', 'Gérant', 'manager@example.test', 1, 0, 0, 'manager')`
		)
		.run();
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, active, created_at, updated_at)
			 values ('manager', 'Gérant', 'Test', 'forward', 30, 1, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at)
			 values ('arena', 'Aréna', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, roster_template_json,
			  generated_at, generation_json, created_at, updated_at)
			 values ('started', '2020-01-05', '09:00', 'arena', 'Aréna', 'scheduled', '{}', null, null, 0, 0),
			        ('future', '2030-01-05', '09:00', 'arena', 'Aréna', 'scheduled', '{}', null, null, 0, 0)`
		)
		.run();
});

function request(id: string, status: 'open' | 'filled'): void {
	sqlite
		.prepare(
			`insert into sub_requests
			 (id, game_id, position, reason, status, created_at, filled_by_player_id, filled_at)
			 values (?, 'future', 'forward', 'manual', ?, 0, ?, ?)`
		)
		.run(id, status, status === 'filled' ? 'manager' : null, status === 'filled' ? 1 : null);
}

function statusOf(gameId: string): string {
	return (
		sqlite.prepare('select status from games where id = ?').get(gameId) as { status: string }
	).status;
}

describe('annulation administrative', () => {
	it('refuse un match déjà commencé, même encore programmé', () => {
		expect(captureError(() => cancelGame(manager, 'started'))).toMatchObject({
			code: 'CONFLICT',
			key: 'admin.gameNotScheduled'
		});
		expect(statusOf('started')).toBe('scheduled');
	});

	it('annule le match, ferme les demandes et audite dans une transaction', () => {
		request('open', 'open');
		request('filled', 'filled');

		cancelGame(manager, 'future');

		expect(statusOf('future')).toBe('cancelled');
		expect(
			sqlite
				.prepare("select id, status, filled_by_player_id from sub_requests order by id")
				.all()
		).toEqual([
			{ id: 'filled', status: 'cancelled', filled_by_player_id: 'manager' },
			{ id: 'open', status: 'cancelled', filled_by_player_id: null }
		]);
		expect(
			sqlite
				.prepare("select count(*) as count from audit_log where action = 'game.cancel'")
				.get()
		).toEqual({ count: 1 });
	});

	it('laisse le match intact quand la fermeture des demandes échoue', () => {
		request('open', 'open');
		sqlite
			.prepare(
				`create trigger fail_requests before update on sub_requests
				 begin select raise(abort, 'closure failed'); end;`
			)
			.run();

		expect(captureError(() => cancelGame(manager, 'future'))).toBeInstanceOf(Error);

		expect(statusOf('future')).toBe('scheduled');
		expect(
			sqlite.prepare("select status from sub_requests where id = 'open'").get()
		).toEqual({ status: 'open' });
		expect(
			sqlite
				.prepare("select count(*) as count from audit_log where action = 'game.cancel'")
				.get()
		).toEqual({ count: 0 });
	});
});
