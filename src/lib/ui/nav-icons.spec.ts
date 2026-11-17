import { describe, expect, it } from 'vitest';
import { SURFACES } from '#config/surfaces.ts';
import { NAV_ICON_PATHS } from './nav-icons.ts';

describe('icônes de navigation', () => {
	it('fournit un dessin pour chaque surface déclarée', () => {
		for (const surface of SURFACES) {
			expect(NAV_ICON_PATHS[surface.icon], surface.key).toBeTruthy();
		}
	});

	it('ne réutilise pas le dessin de l’accueil comme doublure silencieuse', () => {
		const paths = Object.entries(NAV_ICON_PATHS);
		const unique = new Set(paths.map(([, path]) => path));

		expect(unique.size).toBe(paths.length);
	});
});
