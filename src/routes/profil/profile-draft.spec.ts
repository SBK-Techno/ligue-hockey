import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'svelte/compiler';

const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');
const ast = parse(source, { modern: true });

type Directive = { type: string; name: string; expression?: { start: number; end: number } };
type Element = {
	type: string;
	name: string;
	attributes: Directive[];
	[key: string]: unknown;
};

function elements(name: string): Element[] {
	const found: Element[] = [];
	const seen = new WeakSet<object>();
	function walk(node: unknown): void {
		if (!node || typeof node !== 'object' || seen.has(node)) return;
		seen.add(node);
		const element = node as Element;
		if (element.type === 'RegularElement' && element.name === name) found.push(element);
		for (const [key, value] of Object.entries(element)) {
			if (key === 'parent') continue;
			if (Array.isArray(value)) value.forEach(walk);
			else if (value && typeof value === 'object') walk(value);
		}
	}
	walk(ast);
	return found;
}

function attribute(element: Element, name: string): string | undefined {
	const value = element.attributes.find(
		(entry) => entry.type === 'Attribute' && entry.name === name
	) as { value?: Array<{ data?: string }> } | undefined;
	return value?.value?.map((part) => part.data ?? '').join('');
}

function directive(element: Element, name: string): string | undefined {
	const use = element.attributes.find(
		(entry) => entry.type === 'UseDirective' && entry.name === name
	);
	if (!use?.expression) return undefined;
	return source.slice(use.expression.start, use.expression.end);
}

function form(action: string): Element {
	const match = elements('form').find((element) => attribute(element, 'action') === action);
	expect(match, action).toBeDefined();
	return match as Element;
}

describe('brouillon de la fiche de joueur', () => {
	it.each(['firstName', 'lastName', 'age', 'jerseyNumber'])(
		'lie %s au brouillon local, pas aux données de la page',
		(id) => {
			const input = elements('input').find((element) => attribute(element, 'id') === id);
			expect(input, id).toBeDefined();
			const bind = input?.attributes.find(
				(entry) => entry.type === 'BindDirective' && entry.name === 'value'
			) as { expression?: { start: number; end: number } } | undefined;
			expect(bind?.expression, id).toBeDefined();
			expect(source.slice(bind?.expression?.start, bind?.expression?.end)).toBe(`identity.${id}`);
		}
	);

	it('ne resynchronise le brouillon qu’après l’enregistrement de la fiche', () => {
		expect(directive(form('?/profile'), 'progressiveForm')).toContain('syncIdentityDraft');
		expect(directive(form('?/notifications'), 'progressiveForm')).toBeUndefined();
		expect(directive(form('?/positions'), 'progressiveForm')).toBeUndefined();
	});
});
