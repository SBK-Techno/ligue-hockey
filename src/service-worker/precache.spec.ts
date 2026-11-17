import { describe, expect, it } from 'vitest';
import { branding } from '#lib/generated/branding.ts';
import { precachePaths } from './precache.ts';

describe('liste de précache', () => {
	const paths = precachePaths(
		['/_app/immutable/entry/start.js', '/_app/immutable/chunks/app.js'],
		branding
	);

	it('garde la coquille, la page hors ligne et le manifeste', () => {
		expect(paths).toContain('/_app/immutable/entry/start.js');
		expect(paths).toContain('/offline.html');
		expect(paths).toContain('/manifest.webmanifest');
		expect(paths).toContain(branding.icons.favicon);
		expect(paths).toContain(branding.icons.icon192);
	});

	it('n’installe ni la photo de connexion, ni l’aperçu social, ni les textures', () => {
		expect(paths.some((path) => path.startsWith('/auth/'))).toBe(false);
		expect(paths).not.toContain(branding.socialImage);
		expect(paths.some((path) => path.startsWith('/textures/'))).toBe(false);
		expect(paths.some((path) => path.startsWith('/identities/'))).toBe(false);
	});
});
