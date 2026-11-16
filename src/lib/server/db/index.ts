import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { env } from '#lib/shared/config/env.ts';
import { logger } from '#lib/shared/logging/logger.ts';
import * as schema from './schema.ts';

if (env.databaseUrl !== ':memory:') {
	mkdirSync(dirname(env.databaseUrl), { recursive: true });
}

const sqlite = new Database(env.databaseUrl);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma(`busy_timeout = ${env.busyTimeoutMs}`);
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };

let closed = false;

export function closeDatabase(): void {
	if (closed) return;
	closed = true;
	try {
		sqlite.pragma('wal_checkpoint(TRUNCATE)');
	} catch (error) {
		logger.warn('db.checkpoint_failed', { error });
	}
	sqlite.close();
	logger.info('db.closed');
}

process.once('sveltekit:shutdown', () => {
	closeDatabase();
});
