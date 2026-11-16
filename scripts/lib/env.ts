import { parseEnv } from '#config/env-schema.ts';

try {
	process.loadEnvFile('.env');
} catch {
	// Environment is supplied by the container in production.
}

export const scriptEnv = parseEnv(process.env);
