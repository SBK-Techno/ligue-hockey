import { auth } from '#lib/server/auth.ts';
import { env } from '#lib/shared/config/env.ts';
import { logger } from '#lib/shared/logging/logger.ts';

export async function ensureBootstrapAdmin(): Promise<void> {
	const credentials = env.adminBootstrap;
	if (!credentials) return;

	const context = await auth.$context;
	const existing = await context.internalAdapter.findUserByEmail(
		credentials.email
	);
	if (existing) {
		logger.debug('auth.bootstrap_admin_present');
		return;
	}

	await auth.api.createUser({
		body: {
			email: credentials.email,
			password: credentials.password,
			name: 'Administrateur',
			role: 'admin'
		}
	});

	logger.info('auth.bootstrap_admin_created');
}
