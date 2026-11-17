import { readFileSync, statSync } from 'node:fs';
import {
	MEASURED_PAGES,
	PERFORMANCE_BUDGETS,
	type PerformanceBudget
} from '#config/performance.ts';

/**
 * Les contrôles de budget de la CI. Le smoke télécharge une page puis délègue
 * ici la mesure; les tests de contrat peuvent appeler les mêmes fonctions.
 */
export function assertSize(
	label: string,
	bytes: number,
	budget: PerformanceBudget
): void {
	const maximum = PERFORMANCE_BUDGETS[budget];
	if (bytes > maximum) {
		throw new Error(`${label}: ${bytes} octets pour un budget de ${maximum}.`);
	}
}

export function inlineCssBytes(html: string): number {
	return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].reduce(
		(total, match) => total + Buffer.byteLength(match[1], 'utf8'),
		0
	);
}

export function jsRequests(html: string): number {
	return new Set(
		[...html.matchAll(/\/_app\/immutable\/[^"'\s>]+\.js/g)].map((match) => match[0])
	).size;
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
	budget: PerformanceBudget
): void {
	const count = jsRequests(html);
	const maximum = PERFORMANCE_BUDGETS[budget];
	if (count > maximum) {
		throw new Error(`${label}: ${count} requêtes JavaScript pour un budget de ${maximum}.`);
	}
}

const [command, path, budget] = process.argv.slice(2);

if (command === 'pages') {
	process.stdout.write(
		MEASURED_PAGES.map((page) => `${page.name}\t${page.path}\t${page.budget}`).join('\n') + '\n'
	);
} else if (command) {
	try {
		if (!path || !budget) {
			throw new Error('usage: budget.ts <size|inline-css|js-requests> <fichier> <budget>');
		}
		const content = readFileSync(path);
		let detail = '';
		if (command === 'size') {
			assertSize(path, statSync(path).size, budget as PerformanceBudget);
		} else if (command === 'inline-css') {
			assertInlineCss(path, content.toString('utf8'), budget as PerformanceBudget);
		} else if (command === 'js-requests') {
			const html = content.toString('utf8');
			const count = jsRequests(html);
			assertJsRequests(path, html, budget as PerformanceBudget);
			detail = `, ${count} requêtes`;
		} else {
			throw new Error(`commande inconnue: ${command}`);
		}
		process.stdout.write(`${command} ${path}: conforme (${budget}${detail})\n`);
	} catch (error) {
		process.stderr.write(`${(error as Error).message}\n`);
		process.exit(1);
	}
}
