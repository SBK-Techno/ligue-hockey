import { statSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MATERIALS } from '#config/materials.ts';
import { PERFORMANCE_BUDGETS } from '#config/performance.ts';
import { branding } from '#lib/generated/branding.ts';

describe('matières générées', () => {
	it.each(Object.entries(branding.textures))(
		'%s est une tuile %ipx sous le budget, sans canal écrêté',
		async (_name, publicPath) => {
			const file = `static${publicPath}`;
			expect(statSync(file).size).toBeLessThanOrEqual(PERFORMANCE_BUDGETS.textureBytes);
			const meta = await sharp(file).metadata();
			expect([meta.width, meta.height]).toEqual([
				MATERIALS.tileSize,
				MATERIALS.tileSize
			]);
			const stats = await sharp(file).stats();
			expect(Math.max(...stats.channels.map((channel) => channel.max))).toBeLessThan(255);
		}
	);
});

describe('photo de connexion responsive', () => {
	it('expose les trois largeurs et garde la variante mobile sous 35 Ko', () => {
		const sources = branding.auth.srcset.split(', ').map((entry) => {
			const [path, descriptor] = entry.split(' ');
			return { path, width: Number(descriptor.replace('w', '')) };
		});
		expect(sources.map((source) => source.width)).toEqual([640, 960, 1200]);
		for (const source of sources) {
			const size = statSync(`static${source.path}`).size;
			const budget =
				source.width === 640
					? PERFORMANCE_BUDGETS.authMobileImageBytes
					: PERFORMANCE_BUDGETS.authDesktopImageBytes;
			expect(size, source.path).toBeLessThanOrEqual(budget);
		}
	});
});
