import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { databaseHealth } from '#lib/server/health.ts';
import { schedulerHeartbeat } from '#lib/server/notifications/scheduler.ts';
import { logger } from '#lib/shared/logging/logger.ts';

export const GET: RequestHandler = () => {
	try {
		const database = databaseHealth();
		return json({
			status: 'ok',
			database: 'ok',
			migrations: database.migrations,
			scheduler: { lastTickAt: schedulerHeartbeat() }
		});
	} catch (error) {
		logger.error('health.failed', { error });
		return json({ status: 'error' }, { status: 503 });
	}
};
