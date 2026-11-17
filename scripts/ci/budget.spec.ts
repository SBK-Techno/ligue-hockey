import { describe, expect, it } from 'vitest';
import { MEASURED_PAGES, PERFORMANCE_BUDGETS } from '#config/performance.ts';
import {
	assertInlineCss,
	assertJsRequests,
	assertSize,
	inlineCssBytes,
	jsRequests
} from './budget.ts';

describe('budgets de page', () => {
	it('refuse une page de 376 Ko pour le budget de discussion', () => {
		expect(() => assertSize('discussion', 376_000, 'discussionHtmlBytes')).toThrow(
			/376000 octets/
		);
	});

	it('accepte une page sous le budget', () => {
		expect(() => assertSize('discussion', 120_000, 'discussionHtmlBytes')).not.toThrow();
	});

	it('ne compte que la tranche critique inlinée', () => {
		const html = '<style>a{color:red}</style><p>x</p><style>b{color:blue}</style>';
		expect(inlineCssBytes(html)).toBe(25);
		expect(() => assertInlineCss('connexion', html, 'authInlineCssBytes')).not.toThrow();
	});

	it('compte chaque requête JavaScript une seule fois', () => {
		const html = `
			<link rel="modulepreload" href="/_app/immutable/entry/start.A.js">
			<link rel="modulepreload" href="/_app/immutable/chunks/B.js">
			<link rel="modulepreload" href="/_app/immutable/chunks/B.js">
		`;
		expect(jsRequests(html)).toBe(2);
		expect(() => assertJsRequests('discussion', html, 'jsRequestsPerPage')).not.toThrow();
	});

	it('refuse un graphe au-dessus du budget', () => {
		const links = Array.from(
			{ length: 21 },
			(_, index) => `<link rel="modulepreload" href="/_app/immutable/chunks/${index}.js">`
		).join('');
		expect(() => assertJsRequests('discussion', links, 'jsRequestsPerPage')).toThrow(
			/21 requêtes JavaScript/
		);
	});

	it('applique le même budget à chaque page déclarée par le propriétaire', () => {
		expect(MEASURED_PAGES.length).toBeGreaterThan(0);
		for (const page of MEASURED_PAGES) {
			const links = Array.from(
				{ length: PERFORMANCE_BUDGETS.jsRequestsPerPage + 1 },
				(_, index) => `<link rel="modulepreload" href="/_app/immutable/chunks/${index}.js">`
			).join('');
			expect(() => assertJsRequests(page.name, links, page.budget), page.name).toThrow(
				/21 requêtes JavaScript/
			);
		}
	});
});
