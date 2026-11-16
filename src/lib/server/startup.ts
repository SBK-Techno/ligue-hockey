import { runMigrations } from '#lib/server/db/migrate.ts';
import { ensureBootstrapAdmin } from '#lib/server/auth/bootstrap.ts';
import { betterAuthIdentity } from '#lib/server/auth/identity.ts';
import { provideIdentity } from '#lib/domain/auth/identity.ts';
import {
	startNotificationScheduler,
	stopNotificationScheduler
} from '#lib/server/notifications/scheduler.ts';
import { logger } from '#lib/shared/logging/logger.ts';

let started: Promise<void> | null = null;

async function run(): Promise<void> {
	runMigrations();
	provideIdentity(betterAuthIdentity);
	await ensureBootstrapAdmin();
	startNotificationScheduler();
	process.once('sveltekit:shutdown', stopNotificationScheduler);
	logger.info('app.started');
}

export function startup(): Promise<void> {
	started ??= run();
	return started;
}
