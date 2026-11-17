import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
	MEASURED_PAGES,
	PERFORMANCE_BUDGETS,
	type MeasuredPage,
	type PerformanceBudget
} from '#config/performance.ts';

/**
 * Les contrôles de budget de la CI. Le smoke télécharge une page puis délègue
 * ici la mesure; les tests de contrat peuvent appeler les mêmes fonctions.
 */
function maximumFor(budget: string): number {
	if (!(budget in PERFORMANCE_BUDGETS)) {
		throw new Error(`budget inconnu: ${budget}`);
	}
	return PERFORMANCE_BUDGETS[budget as PerformanceBudget];
}

export function assertMaxSize(label: string, bytes: number, maximum: number): void {
	if (bytes > maximum) {
		throw new Error(`${label}: ${bytes} octets pour un budget de ${maximum}.`);
	}
}

export function assertSize(
	label: string,
	bytes: number,
	budget: PerformanceBudget
): void {
	assertMaxSize(label, bytes, maximumFor(budget));
}

export function inlineCssBytes(html: string): number {
	return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].reduce(
		(total, match) => total + Buffer.byteLength(match[1], 'utf8'),
		0
	);
}

export function jsUrls(html: string): string[] {
	return [
		...new Set(
			[...html.matchAll(/\/_app\/immutable\/[^"'\s>]+\.js/g)].map((match) => match[0])
		)
	];
}

export function jsRequests(html: string): number {
	return jsUrls(html).length;
}

/** Somme des morceaux JavaScript du graphe initial, sans double compte. */
export function jsBytes(html: string, sizeOf: (url: string) => number): number {
	return jsUrls(html).reduce((total, url) => total + sizeOf(url), 0);
}

export function fileSizeOf(assetRoot: string): (url: string) => number {
	return (url) => statSync(join(assetRoot, url.replace(/^\//, ''))).size;
}

/** Les mêmes octets, lus sur le serveur mesuré quand le build local manque. */
export async function remoteSizeOf(
	html: string,
	base: string
): Promise<(url: string) => number> {
	const entries = await Promise.all(
		jsUrls(html).map(async (url) => {
			const response = await fetch(new URL(url, base), {
				headers: { 'accept-encoding': 'identity' }
			});
			if (!response.ok) {
				throw new Error(`${url}: ${response.status} pour la mesure des octets.`);
			}
			return [url, (await response.arrayBuffer()).byteLength] as const;
		})
	);
	const sizes = new Map(entries);
	return (url) => {
		const size = sizes.get(url);
		if (size === undefined) throw new Error(`${url}: morceau absent de la page.`);
		return size;
	};
}

export function assertInlineCss(
	label: string,
	html: string,
	budget: PerformanceBudget
): void {
	assertSize(label, inlineCssBytes(html), budget);
}

export function assertJsRequests(
	label: string,
	html: string,
	maxRequests: number
): void {
	const count = jsRequests(html);
	if (count > maxRequests) {
		throw new Error(`${label}: ${count} requêtes JavaScript pour un budget de ${maxRequests}.`);
	}
}

export function assertJsBytes(
	label: string,
	html: string,
	sizeOf: (url: string) => number
): void {
	const bytes = jsBytes(html, sizeOf);
	if (bytes > PERFORMANCE_BUDGETS.jsBytesPerPage) {
		throw new Error(
			`${label}: ${bytes} octets JavaScript pour un budget de ${PERFORMANCE_BUDGETS.jsBytesPerPage}.`
		);
	}
}

export function measuredPage(name: string): MeasuredPage {
	const page = MEASURED_PAGES.find((entry) => entry.name === name);
	if (!page) throw new Error(`page non déclarée: ${name}`);
	return page;
}

/** Le seul contrôle de page : requêtes selon la route, octets selon le propriétaire. */
export function assertPage(
	label: string,
	html: string,
	sizeOf: (url: string) => number
): void {
	const page = measuredPage(label);
	assertJsRequests(label, html, page.maxRequests);
	assertJsBytes(label, html, sizeOf);
	assertMaxSize(label, Buffer.byteLength(html, 'utf8'), page.maxBytes);
}

const [command, ...args] = process.argv.slice(2);

if (command === 'pages') {
	process.stdout.write(
		MEASURED_PAGES.map(
			(page) => `${page.name}\t${page.path}\t${page.audience}`
		).join('\n') + '\n'
	);
} else if (command) {
	try {
		const [path, value] = args;
		if (!path || !value) {
			throw new Error(
				'usage: budget.ts <size|inline-css|js-requests> <fichier> <budget> | page <fichier> <page> | pages'
			);
		}
		const content = readFileSync(path);
		let detail = '';
		if (command === 'size') {
			assertSize(path, statSync(path).size, value as PerformanceBudget);
		} else if (command === 'inline-css') {
			assertInlineCss(path, content.toString('utf8'), value as PerformanceBudget);
		} else if (command === 'js-requests') {
			const maximum = maximumFor(value);
			const count = jsRequests(content.toString('utf8'));
			assertJsRequests(path, content.toString('utf8'), maximum);
			detail = `, ${count} requêtes`;
		} else if (command === 'page') {
			const page = measuredPage(value);
			const html = content.toString('utf8');
			const count = jsRequests(html);
			const assetRoot = process.env.ASSET_ROOT;
			const assetBase = process.env.ASSET_BASE;
			const sizeOf = assetRoot
				? fileSizeOf(assetRoot)
				: assetBase
					? await remoteSizeOf(html, assetBase)
					: null;
			if (!sizeOf) {
				throw new Error('ASSET_ROOT ou ASSET_BASE requis pour mesurer les octets.');
			}
			assertPage(value, html, sizeOf);
			detail = `, ${count}/${page.maxRequests} requêtes`;
		} else {
			throw new Error(`commande inconnue: ${command}`);
		}
		process.stdout.write(`${command} ${path}: conforme (${value}${detail})\n`);
	} catch (error) {
		process.stderr.write(`${(error as Error).message}\n`);
		process.exit(1);
	}
}
