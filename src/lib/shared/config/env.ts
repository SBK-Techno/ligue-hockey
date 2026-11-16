import { building } from '$app/env';
import {
	DATABASE_URL,
	ORIGIN,
	BETTER_AUTH_SECRET,
	SESSION_DAYS,
	INVITE_DAYS,
	LOGIN_WINDOW_MINUTES,
	MAX_LOGIN_ATTEMPTS,
	RESET_REQUESTS_PER_HOUR,
	PASSWORD_CHANGES_PER_HOUR,
	VAPID_PRIVATE_KEY,
	VAPID_SUBJECT,
	SMTP_HOST,
	SMTP_PORT,
	SMTP_SECURE,
	SMTP_USER,
	SMTP_PASSWORD,
	SMTP_FROM,
	ADMIN_EMAIL,
	ADMIN_PASSWORD,
	LOG_LEVEL,
	NOTIFICATION_TICK_MS,
	NOTIFICATION_MAX_ATTEMPTS,
	NOTIFICATION_BATCH_SIZE,
	NOTIFICATION_CLAIM_TIMEOUT_MS,
	MIGRATIONS_DIR,
	DATABASE_BUSY_TIMEOUT_MS,
	APP_ENV
} from '$app/env/private';
import { VAPID_PUBLIC_KEY } from '$app/env/public';

function required<T>(value: T | undefined, name: string): T {
	if (value === undefined || value === '') {
		if (building) {
			return value as T;
		}
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

const publicKey = VAPID_PUBLIC_KEY || undefined;
const privateKey = VAPID_PRIVATE_KEY || undefined;
const subject = VAPID_SUBJECT || undefined;

const origin = required(ORIGIN, 'ORIGIN');
if (!building && APP_ENV === 'production' && !origin.startsWith('https://')) {
	throw new Error('ORIGIN must use https in production');
}

export const env = Object.freeze({
	appEnv: APP_ENV,
	isProduction: APP_ENV === 'production',
	databaseUrl: DATABASE_URL,
	migrationsDir: MIGRATIONS_DIR,
	busyTimeoutMs: DATABASE_BUSY_TIMEOUT_MS,
	origin,
	betterAuthSecret: required(BETTER_AUTH_SECRET, 'BETTER_AUTH_SECRET'),
	security: Object.freeze({
		sessionDays: SESSION_DAYS,
		inviteDays: INVITE_DAYS,
		loginWindowMinutes: LOGIN_WINDOW_MINUTES,
		maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
		resetRequestsPerHour: RESET_REQUESTS_PER_HOUR,
		passwordChangesPerHour: PASSWORD_CHANGES_PER_HOUR
	}),
	logLevel: LOG_LEVEL,
	notificationTickMs: NOTIFICATION_TICK_MS,
	notificationMaxAttempts: NOTIFICATION_MAX_ATTEMPTS,
	notificationBatchSize: NOTIFICATION_BATCH_SIZE,
	notificationClaimTimeoutMs: NOTIFICATION_CLAIM_TIMEOUT_MS,
	vapid:
		publicKey && privateKey && subject
			? Object.freeze({
					publicKey,
					privateKey,
					subject
				})
			: null,
	smtp:
		SMTP_HOST && SMTP_FROM
			? Object.freeze({
					host: SMTP_HOST,
					port: SMTP_PORT,
					secure: SMTP_SECURE,
					user: SMTP_USER || undefined,
					password: SMTP_PASSWORD || undefined,
					from: SMTP_FROM
				})
			: null,
	adminBootstrap:
		ADMIN_EMAIL && ADMIN_PASSWORD
			? Object.freeze({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
			: null
});

export type Env = typeof env;
