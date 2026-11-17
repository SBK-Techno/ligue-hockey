import { describe, expect, it } from 'vitest';
import { formatDate } from '#lib/shared/i18n/index.ts';
import { resolvePageTitle } from './page-title.ts';

const branding = { brandName: 'Ligue de hockey du dimanche matin', shortName: 'LHDM' };

describe('titre de document', () => {
	it('distingue deux détails par leur propre h1', () => {
		const first = formatDate('2026-09-20');
		const second = formatDate('2026-09-27');
		const titles = [first, second].map((detail) =>
			resolvePageTitle({ ...branding, pathname: '/matchs/journee', detail })
		);

		expect(titles[0]).toContain(first);
		expect(titles[1]).toContain(second);
		expect(new Set(titles).size).toBe(2);
		expect(titles[0]).toBe(`${first} · LHDM`);
	});

	it('garde le titre de section pour une route sans détail', () => {
		expect(resolvePageTitle({ ...branding, pathname: '/matchs' })).toBe('Matchs · LHDM');
		expect(resolvePageTitle({ ...branding, pathname: '/admin/joueurs/joueur-1' })).toBe(
			'Joueurs · LHDM'
		);
		expect(resolvePageTitle({ ...branding, pathname: '/admin/joueurs/joueur-1', detail: 'Jean Tremblay' })).toBe(
			'Jean Tremblay · LHDM'
		);
	});

	it('garde le nom de marque seul sur l’accueil et les routes inconnues', () => {
		expect(resolvePageTitle({ ...branding, pathname: '/' })).toBe(branding.brandName);
		expect(resolvePageTitle({ ...branding, pathname: '/inconnue' })).toBe(branding.brandName);
	});
});
