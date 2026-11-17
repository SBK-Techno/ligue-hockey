import { describe, expect, it } from 'vitest';
import { branding } from '#lib/generated/branding.ts';
import { PRECACHE_LIMITS, RUNTIME_CACHE_ENTRIES, precachePaths } from './precache.ts';

describe('liste de précache', () => {
	const paths = precachePaths(
		[
			'/_app/immutable/entry/start.js',
			'/_app/immutable/entry/app.js',
			'/_app/immutable/nodes/3.js',
			'/_app/immutable/chunks/route.js',
			'/_app/immutable/assets/font.woff2',
			'/auth/dressing-room.webp'
		],
		branding
	);

	it('garde la coquille, la page hors ligne et le manifeste', () => {
		expect(paths).toContain('/_app/immutable/entry/start.js');
		expect(paths).toContain('/_app/immutable/entry/app.js');
		expect(paths).toContain('/offline.html');
		expect(paths).toContain('/manifest.webmanifest');
		expect(paths).toContain(branding.icons.favicon);
		expect(paths).toContain(branding.icons.icon192);
	});

	it('laisse les morceaux de route et les médias au cache d’exécution', () => {
		expect(paths.some((path) => path.includes('/nodes/'))).toBe(false);
		expect(paths.some((path) => path.includes('/chunks/'))).toBe(false);
		expect(paths.some((path) => path.includes('/assets/'))).toBe(false);
		expect(paths.some((path) => path.startsWith('/auth/'))).toBe(false);
		expect(paths).not.toContain(branding.socialImage);
		expect(paths.some((path) => path.startsWith('/textures/'))).toBe(false);
		expect(paths.some((path) => path.startsWith('/identities/'))).toBe(false);
	});

	it('borne les entrées du précache et du cache d’exécution', () => {
		expect(paths.length).toBeLessThanOrEqual(PRECACHE_LIMITS.entries);
		expect(PRECACHE_LIMITS.bytes).toBeGreaterThan(0);
		expect(RUNTIME_CACHE_ENTRIES).toBeGreaterThan(PRECACHE_LIMITS.entries);

		expect(() =>
			precachePaths(
				Array.from(
					{ length: PRECACHE_LIMITS.entries },
					(_, index) => `/_app/immutable/entry/${index}.js`
				),
				branding
			)
		).toThrow(/budget/);
	});
});
