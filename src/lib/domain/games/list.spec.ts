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
const { listGameListEntries } = await import('./service.ts');

const actor: Actor = {
	kind: 'user',
	active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

function seedGames(count: number): string[] {
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at)
			 values ('loc', 'Aréna test', 0, 0)`
		)
		.run();
	const ids: string[] = [];
	for (let index = 0; index < count; index += 1) {
		const id = `game-${index}`;
		const day = String(1 + (index % 28)).padStart(2, '0');
		ids.push(id);
		sqlite
			.prepare(
				`insert into games
				 (id, game_date, start_time, location_id, location, roster_template_json, created_at, updated_at)
				 values (?, ?, '09:00', 'loc', 'Aréna test', '{}', 0, 0)`
			)
			.run(id, `2026-11-${day}`);
		for (const [team, position, slotIndex] of [
			['white', 'forward', 0],
			['white', 'forward', 1],
			['black', 'forward', 0],
			['black', 'defense', 0]
		] as const) {
			sqlite
				.prepare(
					`insert into game_slots
					 (id, game_id, team, position, slot_index, created_at, updated_at)
					 values (?, ?, ?, ?, ?, 0, 0)`
				)
				.run(`${id}-${team}-${position}-${slotIndex}`, id, team, position, slotIndex);
		}
	}
	return ids;
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
	for (const table of ['game_availability', 'game_slots', 'games', 'locations', 'players', 'user']) {
		sqlite.prepare(`delete from ${table}`).run();
	}
});

describe('projection de liste des matchs', () => {
	it('borne le nombre de requêtes, quel que soit le nombre de matchs', () => {
		const ids = seedGames(25);

		const small = counted(() => listGameListEntries(actor, ids.slice(0, 2)));
		const large = counted(() => listGameListEntries(actor, ids));

		expect(small.value.size).toBe(2);
		expect(large.value.size).toBe(25);
		expect(small.statements).toBe(2);
		expect(large.statements).toBe(small.statements);
		expect(large.value.get(ids[0])?.openSlots).toBe(4);
		expect(large.value.get(ids[0])?.openSlotsLabel).toContain('4');
	});
});
