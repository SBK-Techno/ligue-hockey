import { runMigrations } from '#lib/server/db/migrate.ts';
import { ensureBootstrapAdmin } from '#lib/server/auth/bootstrap.ts';
import { betterAuthIdentity } from '#lib/server/auth/identity.ts';
import { provideIdentity } from '#lib/domain/auth/identity.ts';
import {
	startNotificationScheduler,
	stopNotificationScheduler
} from '#lib/server/notifications/scheduler.ts';
import { stopUpcomingRegeneration } from '#lib/domain/games/upcoming.ts';
import { closeDatabase } from '#lib/server/db/index.ts';
import { logger } from '#lib/shared/logging/logger.ts';

let started: Promise<void> | null = null;

async function run(): Promise<void> {
	runMigrations();
	provideIdentity(betterAuthIdentity);
	await ensureBootstrapAdmin();
	startNotificationScheduler();
	// L'ordre d'arrêt est un seul propriétaire : le recalcul en attente part
	// avant la fermeture de la base, puis le planificateur s'arrête.
	process.once('sveltekit:shutdown', () => {
		stopUpcomingRegeneration();
		stopNotificationScheduler();
		closeDatabase();
	});
	logger.info('app.started');
}

export function startup(): Promise<void> {
	started ??= run();
	return started;
}
