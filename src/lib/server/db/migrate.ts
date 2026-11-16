import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { env } from '#lib/shared/config/env.ts';
import { logger } from '#lib/shared/logging/logger.ts';
import { db } from './index.ts';

let migrated = false;

export function runMigrations(): void {
	if (migrated) return;
	logger.info('db.migrating', { folder: env.migrationsDir });
	migrate(db, { migrationsFolder: env.migrationsDir });
	migrated = true;
	logger.info('db.migrated');
}
