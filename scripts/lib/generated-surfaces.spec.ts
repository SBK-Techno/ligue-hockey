import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	GENERATED_SURFACES,
	assertDeclaredSurfaces,
	generatedSurfaceFor
} from './generated-surfaces.ts';
import { EXCLUDED_ROOT_PAGES, pages } from '../docs/pages.ts';

const ROOT = process.cwd();

describe('surfaces générées', () => {
	it('déclare chaque fichier du manifeste de checksums', () => {
		const manifest = JSON.parse(
			readFileSync(join(ROOT, 'static/generated-assets.json'), 'utf8')
		) as { files: Record<string, string> };

		expect(() => assertDeclaredSurfaces(Object.keys(manifest.files))).not.toThrow();
	});

	it('refuse une sortie qui n’est pas déclarée', () => {
		expect(generatedSurfaceFor('src/env.ts')).toBeUndefined();
		expect(() => assertDeclaredSurfaces(['static/icons/a.png', 'src/env.ts'])).toThrow(
			/src\/env\.ts/
		);
	});

	it('nomme chaque surface dans ARCHITECTURE.md', () => {
		const architecture = readFileSync(join(ROOT, 'ARCHITECTURE.md'), 'utf8');
		for (const surface of GENERATED_SURFACES) {
			expect(architecture, surface.label).toContain(surface.docs);
		}
	});

	it('couvre chaque Markdown racine par une page ou une exclusion', () => {
		const published = new Set(pages.map((page) => page.source));
		const excluded = new Set(EXCLUDED_ROOT_PAGES.map((page) => page.source));
		const rootPages = readdirSync(ROOT).filter((file) => file.endsWith('.md'));

		expect(rootPages.filter((file) => !published.has(file) && !excluded.has(file))).toEqual([]);
	});
});
