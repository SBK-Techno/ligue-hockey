import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { adminAc, userAc } from 'better-auth/plugins/admin/access';
import type { Role } from 'better-auth/plugins/access';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { building } from '$app/env';
import { getRequestEvent } from '$app/server';
import { branding } from '#lib/generated/branding.ts';
import { env } from '#lib/shared/config/env.ts';
import { publicEnv } from '#lib/shared/config/public-env.ts';
import { passwordLinkPurpose } from '#lib/domain/auth/identity.ts';
import { logger } from '#lib/shared/logging/logger.ts';
import { db } from '#lib/server/db/index.ts';

// Route analysis imports this module during `vite build`, where deployment
// secrets are intentionally absent. These fallbacks never apply at runtime:
// `env` refuses to start without them outside a build.
const BUILD_ORIGIN = 'http://localhost:3000';
const BUILD_SECRET = 'build-only-placeholder-secret-not-used-at-runtime';
const origin = env.origin || (building ? BUILD_ORIGIN : '');
const secret = env.betterAuthSecret || (building ? BUILD_SECRET : '');

export const auth = betterAuth({
	appName: branding.name,
	baseURL: origin,
	secret,
	trustedOrigins: [origin],
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		requireEmailVerification: false,
		minPasswordLength: publicEnv.passwordMinLength,
		maxPasswordLength: 128,
		resetPasswordTokenExpiresIn: env.security.inviteDays * 24 * 60 * 60,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword: async ({ user, url }) => {
			const { sendAccountAccess, sendPasswordReset } = await import(
				'#lib/domain/notifications/service.ts'
			);
			const { triggerNotificationTick } = await import(
				'#lib/server/notifications/scheduler.ts'
			);
			const purpose = passwordLinkPurpose(url);
			const payload = {
				userId: user.id,
				name: user.name,
				url,
				expiresInDays: env.security.inviteDays
			};
			try {
				if (purpose === 'invitation') {
					sendAccountAccess(payload);
				} else {
					sendPasswordReset(payload);
				}
				triggerNotificationTick();
			} catch (error) {
				logger.error('auth.password_link_failed', {
					userId: user.id,
					purpose,
					error
				});
				throw error;
			}
		}
	},
	session: {
		expiresIn: env.security.sessionDays * 24 * 60 * 60,
		updateAge: 24 * 60 * 60
	},
	rateLimit: {
		enabled: true,
		window: 10,
		max: 100,
		customRules: {
			'/sign-in/email': {
				window: env.security.loginWindowMinutes * 60,
				max: env.security.maxLoginAttempts
			},
			'/request-password-reset': {
				window: 60 * 60,
				max: env.security.resetRequestsPerHour
			}
		}
	},
	logger: {
		disabled: true
	},
	plugins: [
		admin({
			defaultRole: 'player',
			adminRoles: ['admin'],
			roles: { player: userAc, admin: adminAc } as Record<string, Role>
		}),
		sveltekitCookies(getRequestEvent)
	]
});
