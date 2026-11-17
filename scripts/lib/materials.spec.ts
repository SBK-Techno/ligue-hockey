import { statSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { TEXTURE_KEYS } from '#config/branding-schema.ts';
import { MATERIALS } from '#config/materials.ts';
import { PERFORMANCE_BUDGETS } from '#config/performance.ts';
import { branding } from '#lib/generated/branding.ts';

describe('matières générées', () => {
	it.each(TEXTURE_KEYS)(
		'%s respecte ses dimensions et son budget, sans canal écrêté',
		async (name) => {
			const material = MATERIALS[name];
			const file = `static${branding.textures[name]}`;
			expect(statSync(file).size).toBeLessThanOrEqual(
				PERFORMANCE_BUDGETS[material.budget]
			);
			const meta = await sharp(file).metadata();
			expect([meta.width, meta.height]).toEqual([material.width, material.height]);
			const stats = await sharp(file).stats();
			expect(Math.max(...stats.channels.map((channel) => channel.max))).toBeLessThan(255);
		}
	);
});
