import { defineEnvVars } from '@sveltejs/kit/env';
import { building } from '$app/env';
import { z } from 'zod';
import { envSchema } from '#config/env-schema.ts';

const requiredAtRuntime = <T extends z.ZodType>(schema: T) =>
	building ? schema.optional() : schema;

const fields = envSchema.shape;

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Path to the SQLite database file.',
		schema: fields.DATABASE_URL
	},
	ORIGIN: {
		description: 'Public origin of the application, e.g. https://ligue.example.com.',
		schema: requiredAtRuntime(fields.ORIGIN)
	},
	BETTER_AUTH_SECRET: {
		description: 'Secret used by Better Auth to sign sessions. At least 32 characters.',
		schema: requiredAtRuntime(fields.BETTER_AUTH_SECRET)
	},
	SESSION_DAYS: {
		description: 'Session lifetime in days.',
		schema: fields.SESSION_DAYS
	},
	INVITE_DAYS: {
		description: 'Invitation and password-reset link lifetime in days.',
		schema: fields.INVITE_DAYS
	},
	LOGIN_WINDOW_MINUTES: {
		description: 'Window used to rate-limit authentication requests.',
		schema: fields.LOGIN_WINDOW_MINUTES
	},
	MAX_LOGIN_ATTEMPTS: {
		description: 'Authentication attempts allowed per window.',
		schema: fields.MAX_LOGIN_ATTEMPTS
	},
	PASSWORD_MIN_LENGTH: {
		description: 'Minimum password length shown to users and enforced by Better Auth.',
		public: true,
		schema: fields.PASSWORD_MIN_LENGTH
	},
	VAPID_PUBLIC_KEY: {
		description: 'Web Push VAPID public key.',
		public: true,
		schema: fields.VAPID_PUBLIC_KEY
	},
	VAPID_PRIVATE_KEY: {
		description: 'Web Push VAPID private key.',
		schema: fields.VAPID_PRIVATE_KEY
	},
	VAPID_SUBJECT: {
		description: 'VAPID contact, a mailto: or https: URL.',
		schema: fields.VAPID_SUBJECT
	},
	SMTP_HOST: {
		description: 'SMTP host. When absent, email is written to the application log.',
		schema: fields.SMTP_HOST
	},
	SMTP_PORT: {
		description: 'SMTP port.',
		schema: fields.SMTP_PORT
	},
	SMTP_SECURE: {
		description: 'Use TLS from the first byte (usually true for port 465).',
		schema: fields.SMTP_SECURE
	},
	SMTP_USER: {
		description: 'SMTP username.',
		schema: fields.SMTP_USER
	},
	SMTP_PASSWORD: {
		description: 'SMTP password.',
		schema: fields.SMTP_PASSWORD
	},
	SMTP_FROM: {
		description: 'From address for outgoing email.',
		schema: fields.SMTP_FROM
	},
	ADMIN_EMAIL: {
		description: 'Bootstrap administrator email. Used only when the database has no users.',
		schema: fields.ADMIN_EMAIL
	},
	ADMIN_PASSWORD: {
		description: 'Bootstrap administrator password. Used only when the database has no users.',
		schema: fields.ADMIN_PASSWORD
	},
	LOG_LEVEL: {
		description: 'Minimum log level.',
		schema: fields.LOG_LEVEL
	},
	NOTIFICATION_TICK_MS: {
		description: 'How often the notification scheduler checks for due jobs.',
		schema: fields.NOTIFICATION_TICK_MS
	},
	NOTIFICATION_MAX_ATTEMPTS: {
		description: 'Delivery attempts before a notification job is marked failed.',
		schema: fields.NOTIFICATION_MAX_ATTEMPTS
	},
	NOTIFICATION_BATCH_SIZE: {
		description: 'Maximum notification jobs claimed per scheduler tick.',
		schema: fields.NOTIFICATION_BATCH_SIZE
	},
	NOTIFICATION_CLAIM_TIMEOUT_MS: {
		description: 'Age after which a claimed job is returned to the queue.',
		schema: fields.NOTIFICATION_CLAIM_TIMEOUT_MS
	},
	MIGRATIONS_DIR: {
		description: 'Directory containing generated SQL migrations.',
		schema: fields.MIGRATIONS_DIR
	},
	DATABASE_BUSY_TIMEOUT_MS: {
		description: 'SQLite busy timeout in milliseconds.',
		schema: fields.DATABASE_BUSY_TIMEOUT_MS
	},
	APP_ENV: {
		description: 'Runtime environment.',
		schema: fields.APP_ENV
	}
});
