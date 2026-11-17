import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { envSchema } from '#config/env-schema.ts';
import { envExampleVersion, syncEnvExample } from './env-example.ts';

const SAMPLE = `# Image de production
LIGUE_IMAGE=ghcr.io/sbk-techno/ligue-hockey:1.1.0

DATABASE_URL=./data/ligue.db
`;

describe('env example version', () => {
	it('reads the image version', () => {
		expect(envExampleVersion(SAMPLE)).toBe('1.1.0');
	});

	it('replaces the image version and keeps the rest', () => {
		const next = syncEnvExample(SAMPLE, '1.2.0');
		expect(envExampleVersion(next)).toBe('1.2.0');
		expect(next).toContain('DATABASE_URL=./data/ligue.db');
		expect(next).not.toContain(':1.1.0');
	});

	it('is idempotent', () => {
		expect(syncEnvExample(syncEnvExample(SAMPLE, '1.2.0'), '1.2.0')).toBe(
			syncEnvExample(SAMPLE, '1.2.0')
		);
	});

	it('rejects a missing image line', () => {
		expect(() => envExampleVersion('DATABASE_URL=./data/ligue.db\n')).toThrow(/exactement une/);
	});

	it('rejects duplicate image lines', () => {
		const duplicate = `${SAMPLE}LIGUE_IMAGE=ghcr.io/sbk-techno/ligue-hockey:1.1.0\n`;
		expect(() => envExampleVersion(duplicate)).toThrow(/exactement une/);
		expect(() => syncEnvExample(duplicate, '1.2.0')).toThrow(/exactement une/);
	});

	it('rejects an invalid target version', () => {
		expect(() => syncEnvExample(SAMPLE, '1.2')).toThrow(/Version invalide/);
	});
});

const EXAMPLE = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');

/** Les rares valeurs qui ne viennent pas du schéma mais du déploiement. */
const DEPLOYMENT_VALUES: Record<string, string> = {
	ORIGIN: 'https://hockey.sbktechno.com',
	APP_ENV: 'production',
	VAPID_SUBJECT: 'mailto:admin@example.com'
};

function schemaDefault(key: string): string | undefined {
	const field = (envSchema.shape as Record<string, { safeParse: (value: unknown) => { success: boolean; data?: unknown } }>)[key];
	if (!field) return undefined;
	const result = field.safeParse(undefined);
	if (!result.success || result.data === undefined) return undefined;
	return String(result.data);
}

describe('env example contract', () => {
	it('aligne chaque clé sur la valeur par défaut du schéma, sauf le déploiement', () => {
		const lines = EXAMPLE.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.startsWith('#'));

		for (const line of lines) {
			const separator = line.indexOf('=');
			expect(separator).toBeGreaterThan(0);
			const key = line.slice(0, separator);
			const value = line.slice(separator + 1);
			if (key === 'LIGUE_IMAGE') continue;

			expect(Object.keys(envSchema.shape)).toContain(key);
			if (value === '') continue;
			if (key in DEPLOYMENT_VALUES) {
				expect(value).toBe(DEPLOYMENT_VALUES[key]);
				continue;
			}
			expect(value).toBe(schemaDefault(key));
		}
	});
});
