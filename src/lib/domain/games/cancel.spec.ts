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
	for (const table of ['games', 'locations', 'audit_log', 'user']) {
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
			`insert into locations (id, name, created_at, updated_at)
			 values ('arena', 'Aréna', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, roster_template_json,
			  generated_at, generation_json, created_at, updated_at)
			 values ('started', '2020-01-05', '09:00', 'arena', 'Aréna', 'scheduled', '{}', null, null, 0, 0)`
		)
		.run();
});

describe('annulation administrative', () => {
	it('refuse un match déjà commencé, même encore programmé', () => {
		expect(captureError(() => cancelGame(manager, 'started'))).toMatchObject({
			code: 'CONFLICT',
			key: 'admin.gameNotScheduled'
		});
		const row = sqlite
			.prepare("select status from games where id = 'started'")
			.get() as { status: string };
		expect(row.status).toBe('scheduled');
	});
});
