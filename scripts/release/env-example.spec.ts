import { describe, expect, it } from 'vitest';
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
