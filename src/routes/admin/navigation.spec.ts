import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./+layout.svelte', import.meta.url), 'utf8');

describe('leaving admin', () => {
	it('keeps one back-link owner for both widths', () => {
		expect(source.match(/\{#snippet backToLeague\(/g)).toHaveLength(1);
		expect(source.match(/\{@render backToLeague\(/g)).toHaveLength(2);
		// The only literal home destination lives inside the shared snippet.
		expect(source.match(/href="\/"/g)).toHaveLength(1);
		expect(source).toContain('<span>{label}</span>');
	});

	it('puts the desktop exit before the admin title and tabs', () => {
		const back = source.indexOf("t('nav.backToLeague')");
		const title = source.indexOf("t('admin.title')");
		const tabs = source.indexOf("aria-label={t('nav.admin')}");

		expect(back).toBeGreaterThan(-1);
		expect(title).toBeGreaterThan(back);
		expect(tabs).toBeGreaterThan(title);
	});

	it('labels both exits the same way and uses tabs on mobile', () => {
		expect(source.match(/t\('nav\.backToLeague'\)/g)).toHaveLength(2);
		expect(source).not.toContain('<select');
		expect(source).not.toContain('goto(');
		expect(source).toContain("aria-current={current ? 'page' : undefined}");
	});
});
