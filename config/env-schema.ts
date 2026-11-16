import { z } from 'zod';

const optionalString = z
	.string()
	.optional()
	.transform((value) => value?.trim() || undefined);

const optionalEmail = optionalString.pipe(z.string().email().optional());

const booleanString = z
	.string()
	.optional()
	.transform((value) => value === 'true');

function integer(defaultValue: number, min: number, max: number) {
	return z
		.string()
		.optional()
		.transform((value) =>
			value === undefined || value.trim() === '' ? defaultValue : Number(value)
		)
		.pipe(z.number().int().min(min).max(max));
}

export const envSchema = z.object({
	DATABASE_URL: z.string().min(1).default('./data/ligue.db'),
	ORIGIN: z.string().url(),
	BETTER_AUTH_SECRET: z.string().min(32),
	SESSION_DAYS: integer(30, 1, 365),
	INVITE_DAYS: integer(7, 1, 30),
	LOGIN_WINDOW_MINUTES: integer(15, 1, 1440),
	MAX_LOGIN_ATTEMPTS: integer(5, 1, 50),
	PASSWORD_MIN_LENGTH: integer(10, 8, 128),
	VAPID_PUBLIC_KEY: optionalString,
	VAPID_PRIVATE_KEY: optionalString,
	VAPID_SUBJECT: optionalString,
	SMTP_HOST: optionalString,
	SMTP_PORT: integer(587, 1, 65535),
	SMTP_SECURE: booleanString,
	SMTP_USER: optionalString,
	SMTP_PASSWORD: optionalString,
	SMTP_FROM: optionalString,
	ADMIN_EMAIL: optionalEmail,
	ADMIN_PASSWORD: z
		.string()
		.optional()
		.transform((value) => value || undefined),
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
	NOTIFICATION_TICK_MS: integer(60_000, 1000, 3_600_000),
	NOTIFICATION_MAX_ATTEMPTS: integer(5, 1, 20),
	NOTIFICATION_BATCH_SIZE: integer(50, 1, 500),
	NOTIFICATION_CLAIM_TIMEOUT_MS: integer(600_000, 60_000, 3_600_000),
	MIGRATIONS_DIR: z.string().min(1).default('./drizzle'),
	DATABASE_BUSY_TIMEOUT_MS: integer(5000, 0, 60_000),
	APP_ENV: z.enum(['development', 'test', 'production']).default('development')
});

export type EnvValues = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): EnvValues {
	const result = envSchema.safeParse(input);
	if (!result.success) {
		const issues = result.error.issues
			.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			.join('; ');
		throw new Error(`Invalid environment: ${issues}`);
	}
	return result.data;
}
