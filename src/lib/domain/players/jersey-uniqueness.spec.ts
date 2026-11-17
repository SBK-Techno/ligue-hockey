import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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

const h = vi.hoisted(() => ({
	createUser: vi.fn(),
	deleteUser: vi.fn(),
	updateName: vi.fn(async () => undefined),
	requestPasswordReset: vi.fn(async () => undefined),
	regenerate: vi.fn()
}));

vi.mock('../auth/identity.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('../auth/identity.ts')>();
	return {
		...original,
		identity: () => ({
			createUser: h.createUser,
			deleteUser: h.deleteUser,
			updateName: h.updateName,
			setRole: vi.fn(),
			setAccountState: vi.fn(),
			revokeSessions: vi.fn(),
			requestPasswordReset: h.requestPasswordReset
		})
	};
});

vi.mock('#lib/domain/games/upcoming.ts', () => ({
	regenerateUpcomingGeneratedGames: h.regenerate
}));

const { sqlite } = await import('#lib/server/db/index.ts');
const { adminUpdatePlayer, invitePlayer, updateOwnProfile } = await import('./service.ts');

const NOW = 1_700_000_000_000;
const admin: Actor = {
	kind: 'user',
	userId: 'admin',
	name: 'Admin',
	role: 'admin',
	active: true
};

function addUser(id: string, role: 'player' | 'admin' = 'player'): void {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values (?, ?, ?, 1, ?, ?, ?)`
		)
		.run(id, id, `${id}@example.test`, NOW, NOW, role);
}

function addPlayer(
	id: string,
	options: { jersey?: number | null; active?: boolean; role?: 'player' | 'admin' } = {}
): void {
	addUser(id, options.role ?? 'player');
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, jersey_number, active, created_at, updated_at)
			 values (?, ?, 'Test', 'forward', 30, ?, ?, ?, ?)`
		)
		.run(id, id, options.jersey ?? null, options.active === false ? 0 : 1, NOW, NOW);
}

function jerseyOf(id: string): number | null {
	return (
		sqlite.prepare('select jersey_number from players where user_id = ?').get(id) as {
			jersey_number: number | null;
		}
	).jersey_number;
}

const invite = {
	firstName: 'Nouveau',
	lastName: 'Joueur',
	email: 'nouveau@example.test',
	position: 'forward' as const,
	age: 25,
	jerseyNumber: 12,
	isSubstitute: false
};

beforeEach(() => {
	for (const table of [
		'game_player_ratings',
		'game_goals',
		'game_penalties',
		'game_availability',
		'sub_requests',
		'game_slots',
		'games',
		'locations',
		'players',
		'audit_log',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	addUser('admin', 'admin');
	h.createUser.mockReset();
	h.createUser.mockImplementation(async ({ email, name }: { email: string; name: string }) => {
		const id = 'new-player';
		addUser(id);
		sqlite.prepare('update user set name = ?, email = ? where id = ?').run(name, email, id);
		return { id };
	});
	h.deleteUser.mockReset();
	h.deleteUser.mockImplementation(async (id: string) => {
		sqlite.prepare('delete from user where id = ?').run(id);
	});
	h.regenerate.mockClear();
});

describe('unicité des numéros de chandail actifs', () => {
	it('refuse un doublon à l’invitation sans créer de compte', async () => {
		addPlayer('first', { jersey: 12 });

		await expect(invitePlayer(admin, invite)).rejects.toMatchObject({
			key: 'error.jerseyTaken'
		});
		expect(h.createUser).not.toHaveBeenCalled();
	});

	it('refuse un doublon sur sa propre fiche', async () => {
		addPlayer('me', { jersey: 12 });
		addPlayer('other', { jersey: 13 });

		await expect(
			updateOwnProfile(
				{ kind: 'user', userId: 'me', name: 'me', role: 'player', active: true },
				{ firstName: 'me', lastName: 'Test', age: 30, jerseyNumber: 13 }
			)
		).rejects.toMatchObject({ key: 'error.jerseyTaken' });
		expect(jerseyOf('me')).toBe(12);
	});

	it('refuse un doublon sur la fiche administrateur', async () => {
		addPlayer('first', { jersey: 12 });
		addPlayer('second', { jersey: 13 });

		await expect(
			adminUpdatePlayer(admin, 'second', { jerseyNumber: 12 })
		).rejects.toMatchObject({ key: 'error.jerseyTaken' });
		expect(jerseyOf('second')).toBe(13);
	});

	it('tient l’unicité par l’index partiel, pas par une lecture préalable', () => {
		const index = sqlite
			.prepare(
				"select sql from sqlite_master where type = 'index' and name = 'players_active_jersey_unique'"
			)
			.get() as { sql: string } | undefined;
		expect(index?.sql).toMatch(/unique/i);
		expect(index?.sql).toMatch(/"active" = 1/);

		addPlayer('first', { jersey: 12 });
		addPlayer('second', { jersey: 13 });

		// Une réservation qui aurait perdu la course de lecture ne peut pas
		// être écrite : l'index refuse le doublon même sans pré-vérification.
		expect(() =>
			sqlite.prepare("update players set jersey_number = 12 where user_id = 'second'").run()
		).toThrow(/UNIQUE constraint failed/);
		expect(jerseyOf('second')).toBe(13);
	});

	it('libère le numéro dès la désactivation', async () => {
		addPlayer('first', { jersey: 12 });
		addPlayer('second', { jersey: 13 });

		await adminUpdatePlayer(admin, 'first', { active: false });
		await adminUpdatePlayer(admin, 'second', { jerseyNumber: 12 });

		expect(jerseyOf('second')).toBe(12);
		expect(jerseyOf('first')).toBe(12);
	});

	it('libère le numéro d’un joueur désactivé et le revalide à l’activation', async () => {
		addPlayer('inactive', { jersey: 12, active: false });
		addPlayer('other', { jersey: 13 });

		await adminUpdatePlayer(admin, 'other', { jerseyNumber: 12 });
		expect(jerseyOf('other')).toBe(12);

		await expect(
			adminUpdatePlayer(admin, 'inactive', { active: true })
		).rejects.toMatchObject({ key: 'error.jerseyTaken' });
		expect(
			sqlite.prepare("select active from players where user_id = 'inactive'").get()
		).toEqual({ active: 0 });
	});

	it('refuse un doublon directement au niveau de l’index partiel', () => {
		addPlayer('first', { jersey: 12 });
		addPlayer('second', { jersey: null });

		expect(() =>
			sqlite.prepare("update players set jersey_number = 12 where user_id = 'second'").run()
		).toThrow(/UNIQUE constraint failed: players.jersey_number/);
	});

	it('documente l’index de chandail et la réécriture de suppression', () => {
		const architecture = readFileSync('ARCHITECTURE.md', 'utf8');

		expect(architecture).toContain('players_active_jersey_unique');
		expect(architecture).toContain('Migration `0014`');
		expect(architecture).toContain(
			'rewrites every stored goal, assist and penalty name snapshot'
		);
	});

	it('fait échouer la migration sur un doublon synthétique', () => {
		const migration = readdirSync('drizzle')
			.filter((file) => file.endsWith('.sql'))
			.find((file) =>
				readFileSync(join('drizzle', file), 'utf8').includes('players_active_jersey_unique')
			);
		expect(migration).toBeDefined();
		const sql = readFileSync(join('drizzle', migration!), 'utf8');

		addPlayer('first', { jersey: null });
		addPlayer('second', { jersey: null });
		sqlite.prepare('drop index players_active_jersey_unique').run();
		sqlite
			.prepare("update players set jersey_number = 12 where user_id in ('first', 'second')")
			.run();
		expect(
			sqlite
				.prepare(
					"select count(*) as count from players where active = 1 and jersey_number = 12"
				)
				.get()
		).toEqual({ count: 2 });
		expect(() => sqlite.exec(sql)).toThrow(/UNIQUE constraint failed/);
	});
});
