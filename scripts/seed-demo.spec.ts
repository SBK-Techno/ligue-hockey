import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Le jeu de démonstration est rejouable : une deuxième exécution remplace son
 * propre jeu, jamais les lignes réelles, et laisse exactement le même état.
 * Le test passe par le script réel, avec sa vraie connexion et sa vraie
 * migration, parce que c'est ce que l'opérateur exécute.
 */
const ROOT = process.cwd();
const FOLDER = mkdtempSync(join(tmpdir(), 'seed-demo-'));
const DATABASE = join(FOLDER, 'ligue.db');
const PASSWORD = 'demo-password-123';
const ENV = {
	...process.env,
	DATABASE_URL: DATABASE,
	MIGRATIONS_DIR: join(ROOT, 'drizzle'),
	ORIGIN: 'http://localhost:5173',
	BETTER_AUTH_SECRET: 'seed-demo-test-secret-value-0123456789',
	APP_ENV: 'test',
	LOG_LEVEL: 'error'
};

const TABLES = [
	'players',
	'games',
	'game_slots',
	'game_goals',
	'game_availability',
	'notification_jobs',
	'chat_messages',
	'sub_requests',
	'payments',
	'payment_plans',
	'player_ratings'
] as const;

function prepareDatabase(): void {
	const sqlite = new Database(DATABASE);
	sqlite.pragma('foreign_keys = ON');
	migrate(drizzle(sqlite), { migrationsFolder: join(ROOT, 'drizzle') });
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('admin', 'Admin', 'admin@example.test', 1, 0, 0, 'admin')`
		)
		.run();
	sqlite.close();
}

function runSeed(): void {
	execFileSync(
		process.execPath,
		[
			join(ROOT, 'node_modules/tsx/dist/cli.mjs'),
			join(ROOT, 'scripts/seed-demo.ts'),
			'--yes',
			'--password',
			PASSWORD
		],
		{ cwd: ROOT, env: ENV, stdio: 'pipe' }
	);
}

function withDatabase<T>(read: (sqlite: Database.Database) => T): T {
	const sqlite = new Database(DATABASE, { readonly: true });
	try {
		return read(sqlite);
	} finally {
		sqlite.close();
	}
}

function counts(): Record<string, number> {
	return withDatabase((sqlite) =>
		Object.fromEntries(
			TABLES.map((table) => [
				table,
				(sqlite.prepare(`select count(*) as count from "${table}"`).get() as {
					count: number;
				}).count
			])
		)
	);
}

beforeAll(() => {
	prepareDatabase();
	runSeed();
}, 180_000);

afterAll(() => {
	rmSync(FOLDER, { recursive: true, force: true });
});

describe('jeu de démonstration', () => {
	it('donne un but à chaque match terminé et des totaux de saison non nuls', () => {
		const result = withDatabase((sqlite) => {
			const completed = sqlite
				.prepare("select count(*) as count from games where status = 'completed'")
				.get() as { count: number };
			const scored = sqlite
				.prepare(
					`select count(distinct goals.game_id) as count
					 from game_goals goals
					 join games on games.id = goals.game_id
					 where games.status = 'completed'`
				)
				.get() as { count: number };
			const goals = sqlite
				.prepare(
					`select count(*) as count
					 from game_goals goals
					 join games on games.id = goals.game_id
					 where games.status = 'completed'`
				)
				.get() as { count: number };
			return { completed: completed.count, scored: scored.count, goals: goals.count };
		});

		expect(result.completed).toBe(12);
		expect(result.scored).toBe(result.completed);
		expect(result.goals).toBeGreaterThan(result.completed);
	});

	it('remplace son propre jeu sans laisser de doublon ni d’alignement manuel périmé', () => {
		const first = counts();
		const manualTargets = withDatabase((sqlite) =>
			(
				sqlite
					.prepare("select id from games where id like 'demo_%'")
					.all() as { id: string }[]
			).map((row) => row.id)
		);
		expect(manualTargets.length).toBeGreaterThan(0);

		const writable = new Database(DATABASE);
		try {
			for (const id of manualTargets) {
				writable
					.prepare('update games set lineup_manual_at = ? where id = ?')
					.run(123, id);
			}
		} finally {
			writable.close();
		}

		runSeed();

		expect(counts()).toEqual(first);
		const stale = withDatabase(
			(sqlite) =>
				(sqlite
					.prepare('select count(*) as count from games where lineup_manual_at is not null')
					.get() as { count: number }).count
		);
		expect(stale).toBe(0);

		const duplicates = withDatabase(
			(sqlite) =>
				sqlite
					.prepare(
						`select dedupe_key, count(*) as count
						 from notification_jobs
						 group by dedupe_key
						 having count(*) > 1`
					)
					.all() as { dedupe_key: string; count: number }[]
		);
		expect(duplicates).toEqual([]);
	}, 180_000);
});
