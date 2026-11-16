import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '#lib/server/db/schema.ts';
import { scriptEnv } from './env.ts';

export function openDatabase() {
	if (scriptEnv.DATABASE_URL !== ':memory:') {
		mkdirSync(dirname(scriptEnv.DATABASE_URL), { recursive: true });
	}

	const sqlite = new Database(scriptEnv.DATABASE_URL);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma(`busy_timeout = ${scriptEnv.DATABASE_BUSY_TIMEOUT_MS}`);
	sqlite.pragma('foreign_keys = ON');

	return {
		sqlite,
		db: drizzle(sqlite, { schema })
	};
}

export function migrateDatabase(): void {
	const { sqlite, db } = openDatabase();
	migrate(db, { migrationsFolder: scriptEnv.MIGRATIONS_DIR });
	sqlite.close();
}
