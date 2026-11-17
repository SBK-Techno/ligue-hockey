import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	GENERATED_SURFACES,
	assertDeclaredSurfaces,
	generatedSurfaceFor
} from './generated-surfaces.ts';
import { DOC_SOCIAL_SOURCE } from '../docs/build.ts';
import { EXCLUDED_ROOT_PAGES, pages } from '../docs/pages.ts';

const ROOT = process.cwd();

function readManifest(): { files: Record<string, string> } {
	return JSON.parse(
		readFileSync(join(ROOT, 'static/generated-assets.json'), 'utf8')
	) as { files: Record<string, string> };
}

function sha256(contents: Buffer): string {
	return createHash('sha256').update(contents).digest('hex');
}

describe('surfaces générées', () => {
	it('déclare chaque fichier du manifeste de checksums', () => {
		expect(() => assertDeclaredSurfaces(Object.keys(readManifest().files))).not.toThrow();
	});

	it('sert l’image sociale des docs depuis l’actif manifesté et identique', () => {
		const manifest = readManifest();
		const expected = manifest.files[DOC_SOCIAL_SOURCE];

		expect(expected, DOC_SOCIAL_SOURCE).toBeDefined();
		expect(sha256(readFileSync(join(ROOT, DOC_SOCIAL_SOURCE)))).toBe(expected);
		expect(existsSync(join(ROOT, 'static/social/apercu.jpg'))).toBe(false);
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
