import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'svelte/compiler';

/**
 * La règle axe `dlitem` : un `dt` ou un `dd` n'existe que dans un `dl`.
 * L'analyse porte sur chaque composant rendu par une route, pas sur le texte
 * source : déplacer le balisage sans changer la structure reste valide.
 */
function listItemsOutsideList(source: string): string[] {
	const ast = parse(source, { modern: true });
	const orphans: string[] = [];
	const seen = new WeakSet<object>();

	function walk(node: unknown, ancestors: readonly string[]): void {
		if (!node || typeof node !== 'object' || seen.has(node)) return;
		seen.add(node);
		const element = node as { type?: string; name?: string; [key: string]: unknown };
		if (element.type === 'RegularElement') {
			if (
				(element.name === 'dt' || element.name === 'dd') &&
				!ancestors.includes('dl')
			) {
				orphans.push(element.name);
			}
			const next = [...ancestors, element.name ?? ''];
			for (const [key, value] of Object.entries(element)) {
				if (key === 'parent') continue;
				if (Array.isArray(value)) value.forEach((child) => walk(child, next));
				else if (value && typeof value === 'object') walk(value, next);
			}
			return;
		}
		for (const [key, value] of Object.entries(element)) {
			if (key === 'parent') continue;
			if (Array.isArray(value)) value.forEach((child) => walk(child, ancestors));
			else if (value && typeof value === 'object') walk(value, ancestors);
		}
	}

	walk(ast, []);
	return orphans;
}

function svelteFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return svelteFiles(path);
		return entry.name.endsWith('.svelte') ? [path] : [];
	});
}

describe('règle axe dlitem', () => {
	it('garde chaque dt et dd dans une liste de définition sur toutes les routes', () => {
		const files = [...svelteFiles('src/routes'), ...svelteFiles('src/lib/ui')];
		expect(files.length).toBeGreaterThan(40);

		const orphans = files
			.map((file) => ({ file, names: listItemsOutsideList(readFileSync(file, 'utf8')) }))
			.filter((entry) => entry.names.length > 0);

		expect(orphans).toEqual([]);
	});
});
