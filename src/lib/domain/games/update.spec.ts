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
const { getGame, updateGame } = await import('./service.ts');

const manager: Actor = {
	kind: 'user',
	active: true,
	userId: 'manager',
	name: 'Gérant',
	role: 'manager'
};

const input = {
	gameDate: '2030-01-05',
	startTime: '09:00',
	locationId: 'arena',
	notes: null
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 0, 0));
	for (const table of ['audit_log', 'games', 'locations', 'user']) {
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
			 (id, game_date, start_time, location_id, location, status,
			  roster_template_json, created_at, updated_at)
			 values ('game', '2030-01-05', '09:00', 'arena', 'Aréna', 'scheduled', '{}', 0, 0)`
		)
		.run();
});

describe('jeton de modification d’un match', () => {
	it('refuse un formulaire chargé avant une autre modification', () => {
		const loaded = getGame(manager, 'game');

		// Une autre surface enregistre entre-temps.
		vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 5, 0));
		updateGame(manager, 'game', {
			...input,
			notes: 'Modifié ailleurs',
			expectedUpdatedAt: loaded.updatedAt
		});

		// Le formulaire périmé rejoue son jeton de lecture.
		vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 10, 0));
		expect(() =>
			updateGame(manager, 'game', {
				...input,
				notes: 'Vieille copie',
				expectedUpdatedAt: loaded.updatedAt
			})
		).toThrowError(expect.objectContaining({ code: 'CONFLICT', key: 'games.lineupChanged' }));

		expect(getGame(manager, 'game').notes).toBe('Modifié ailleurs');
	});
});
