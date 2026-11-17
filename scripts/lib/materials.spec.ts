import { readFileSync, statSync } from 'node:fs';
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

/** La largeur choisie par le navigateur pour un viewport CSS et un DPR. */
function selectedWidth(sizes: string, viewport: number, dpr: number): number {
	const conditions = sizes.split(',').map((part) => part.trim().split(/\s+/));
	let cssWidth = viewport;
	for (const [condition, value] of conditions) {
		if (!condition || !value || condition.startsWith('(')) continue;
		cssWidth = Number(value.replace('vw', '')) / 100 * viewport;
		break;
	}
	const candidates = [640, 960, 1200];
	return candidates.find((width) => width >= cssWidth * dpr) ?? candidates[candidates.length - 1]!;
}

describe('photo de connexion responsive', () => {
	it('garde la variante choisie à 390 px DPR3 sous le budget mobile', () => {
		const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
		const sizes = /sizes="([^"]+)"/.exec(layout)?.[1];
		expect(sizes).toBeDefined();
		expect(selectedWidth(sizes!, 390, 3)).toBe(1200);

		const source = branding.auth.srcset
			.split(', ')
			.map((entry) => entry.split(' '))
			.find(([, descriptor]) => descriptor === '1200w');
		expect(source).toBeDefined();
		expect(statSync(`static${source![0]}`).size).toBeLessThanOrEqual(
			PERFORMANCE_BUDGETS.authMobileImageBytes
		);
	});

	it('expose les trois largeurs et garde chaque variante sous son budget', () => {
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
