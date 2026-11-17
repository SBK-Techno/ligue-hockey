import { stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { IDENTITIES } from '#config/identities.ts';
import { IDENTITY_SHEET } from '#config/identity-sheet.ts';
import { PERFORMANCE_BUDGETS } from '#config/performance.ts';
import { buildIdentitySheet } from './branding.ts';

describe('planche des portraits', () => {
	it('a une source peinte pour chaque identité', async () => {
		for (const identity of IDENTITIES) {
			const source = path.join(
				process.cwd(),
				IDENTITY_SHEET.sourceDir,
				`${identity.id}${IDENTITY_SHEET.sourceExtension}`
			);
			await expect(stat(source), identity.id).resolves.toBeDefined();
		}
	});

	it('compose une tuile par identité, sous le budget', async () => {
		const sheet = await buildIdentitySheet(process.cwd());
		const metadata = await sharp(sheet).metadata();
		const rows = Math.ceil(IDENTITIES.length / IDENTITY_SHEET.columns);

		expect(metadata.width).toBe(IDENTITY_SHEET.columns * IDENTITY_SHEET.tileSize);
		expect(metadata.height).toBe(rows * IDENTITY_SHEET.tileSize);
		expect(sheet.length).toBeLessThanOrEqual(PERFORMANCE_BUDGETS.identitySheetBytes);
	});
});
