import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	MEASURED_PAGES,
	PERFORMANCE_BUDGETS
} from '#config/performance.ts';
import {
	assertInlineCss,
	assertJsBytes,
	assertJsRequests,
	assertMaxSize,
	assertPage,
	assertSize,
	inlineCssBytes,
	jsBytes,
	jsRequests,
	measuredPage,
	requestsCeiling
} from './budget.ts';

const CHUNK = 10 * 1024;
const sizeOf = () => CHUNK;

function links(count: number): string {
	return Array.from(
		{ length: count },
		(_, index) =>
			`<link rel="modulepreload" href="/_app/immutable/chunks/${index}.js">`
	).join('');
}

/** Toutes les routes du dépôt, statiques et paramétrées, sans groupe. */
function pageRoutes(directory = 'src/routes'): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return pageRoutes(path);
		if (entry.name !== '+page.svelte') return [];
		const segments = relative('src/routes', directory)
			.split(sep)
			.filter((segment) => segment && !segment.startsWith('('));
		return ['/' + segments.join('/')];
	});
}

describe('budgets de page', () => {
	it('refuse une page de 376 Ko pour le budget de discussion', () => {
		const budget = measuredPage('discussion').maxBytes;
		expect(() => assertMaxSize('discussion', 376_000, budget)).toThrow(/376000 octets/);
	});

	it('accepte une page sous le budget', () => {
		const budget = measuredPage('discussion').maxBytes;
		expect(() => assertMaxSize('discussion', 120_000, budget)).not.toThrow();
	});

	it('refuse un budget inconnu au lieu de le lire comme zéro', () => {
		expect(() => assertSize('discussion', 1, 'notABudget' as never)).toThrow(
			/budget inconnu/
		);
		expect(() => measuredPage('not-a-page')).toThrow(/page non déclarée/);
	});

	it('ne compte que la tranche critique inlinée', () => {
		const html = '<style>a{color:red}</style><p>x</p><style>b{color:blue}</style>';
		expect(inlineCssBytes(html)).toBe(25);
		expect(() => assertInlineCss('connexion', html, 'authInlineCssBytes')).not.toThrow();
	});

	it('compte chaque requête et chaque octet JavaScript une seule fois', () => {
		const html = `
			<link rel="modulepreload" href="/_app/immutable/entry/start.A.js">
			<link rel="modulepreload" href="/_app/immutable/chunks/B.js">
			<link rel="modulepreload" href="/_app/immutable/chunks/B.js">
		`;
		expect(jsRequests(html)).toBe(2);
		expect(jsBytes(html, sizeOf)).toBe(2 * CHUNK);
		expect(() => assertJsRequests('discussion', html, 2)).not.toThrow();
	});

	it('refuse un graphe au-dessus du plafond de la page', () => {
		expect(() => assertJsRequests('discussion', links(21), 20)).toThrow(
			/21 requêtes JavaScript/
		);
	});

	it('refuse un graphe qui double ses octets même sous le plafond de requêtes', () => {
		const html = links(4);
		expect(() =>
			assertJsBytes('discussion', html, () => 2 * PERFORMANCE_BUDGETS.jsBytesPerPage)
		).toThrow(/octets JavaScript/);
	});

	it('applique le plafond de chaque page déclarée', () => {
		for (const page of MEASURED_PAGES) {
			const ceiling = requestsCeiling(page);
			expect(() =>
				assertJsRequests(page.name, links(ceiling + 1), ceiling)
			).toThrow(/requêtes JavaScript/);
			expect(() =>
				assertPage(page.name, links(ceiling), sizeOf)
			).not.toThrow();
			if (page.maxBytes !== undefined) {
				const maxBytes = page.maxBytes;
				expect(() => assertMaxSize(page.name, maxBytes + 1, maxBytes)).toThrow(/octets/);
			}
		}
	});

	it('applique le plafond par défaut à une route sans plafond propre', () => {
		const page = measuredPage('match-detail');
		expect(page.maxRequests).toBeUndefined();
		expect(requestsCeiling(page)).toBe(PERFORMANCE_BUDGETS.jsRequestsPerPage);
		expect(() =>
			assertPage('match-detail', links(PERFORMANCE_BUDGETS.jsRequestsPerPage), sizeOf)
		).not.toThrow();
		expect(() =>
			assertPage('match-detail', links(PERFORMANCE_BUDGETS.jsRequestsPerPage + 1), sizeOf)
		).toThrow(/requêtes JavaScript/);
	});

	it('déclare chaque route du dépôt, y compris les routes à paramètre', () => {
		const declared = MEASURED_PAGES.map((page) => page.path).sort();
		expect(declared).toEqual(pageRoutes().sort());
		expect(declared.filter((path) => path.includes('['))).toHaveLength(5);
	});

	it('garde un plafond global plus serré que le pire plafond déclaré', () => {
		const worst = Math.max(...MEASURED_PAGES.map((page) => requestsCeiling(page)));
		expect(PERFORMANCE_BUDGETS.jsRequestsPerPage).toBeLessThan(worst);
	});
});
