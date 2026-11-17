import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GENERATED_ASSET_RETENTION_DAYS } from './asset-retention.ts';

const DOCS = ['ARCHITECTURE.md', 'OPERATIONS.md', 'PROGRESS.md'];

describe('rétention des actifs générés', () => {
	it('reste plus courte que le cache immuable des actifs nommés', () => {
		expect(GENERATED_ASSET_RETENTION_DAYS).toBeGreaterThan(0);
		expect(GENERATED_ASSET_RETENTION_DAYS).toBeLessThan(365);
	});

	it('renvoie chaque document au propriétaire du nombre, sans le recopier', () => {
		for (const file of DOCS) {
			const text = readFileSync(file, 'utf8');

			expect(text, file).toContain('GENERATED_ASSET_RETENTION_DAYS');
			expect(text, file).not.toMatch(/sept jours|seven days|7 jours|7 days/i);
		}
	});
});
