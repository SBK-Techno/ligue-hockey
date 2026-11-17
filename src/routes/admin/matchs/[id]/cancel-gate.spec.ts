import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
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
const { load } = await import('./+page.server.ts');
const Page = (await import('./+page.svelte')).default;

const NOW = 1_700_000_000_000;
const admin: Actor = {
	kind: 'user',
	userId: 'admin',
	name: 'Admin',
	role: 'admin',
	active: true
};

function addGame(id: string, gameDate: string): void {
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, roster_template_json, created_at, updated_at)
			 values (?, ?, '09:00', 'loc', 'Aréna test', 'scheduled',
			  '{"goaliesPerTeam":1,"forwardsPerTeam":3,"defensePerTeam":2}', ?, ?)`
		)
		.run(id, gameDate, NOW, NOW);
}

function loaded(id: string) {
	return load({
		locals: { actor: admin },
		params: { id }
	} as never) as {
		game: unknown;
		editable: boolean;
		[intelligence: string]: unknown;
	};
}

function renderPage(data: unknown) {
	return render(Page, {
		props: { data: data as never, form: null, params: { id: 'game' } }
	});
}

beforeEach(() => {
	for (const table of ['game_slots', 'games', 'locations', 'players', 'audit_log', 'user']) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('admin', 'Admin', 'admin@example.test', 1, ?, ?, 'admin')`
		)
		.run(NOW, NOW);
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at)
			 values ('loc', 'Aréna test', ?, ?)`
		)
		.run(NOW, NOW);
});

describe('garde d’annulation d’un match', () => {
	it('n’offre pas l’annulation pour un match commencé', () => {
		addGame('past', '2000-01-04');
		const data = loaded('past');

		expect(data.editable).toBe(false);
		expect(renderPage(data).body).not.toContain('action="?/cancel"');
	});

	it('offre l’annulation pour un match encore modifiable', () => {
		addGame('future', '2999-01-04');
		const data = loaded('future');

		expect(data.editable).toBe(true);
		expect(renderPage(data).body).toContain('action="?/cancel"');
	});
});
