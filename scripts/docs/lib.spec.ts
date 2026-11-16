import { describe, expect, it } from 'vitest';
import { addHeadingIds, escapeHtml, rewriteLinks, slugify } from './lib.ts';

describe('documentation helpers', () => {
	it('slugifies French headings without accents', () => {
		expect(slugify('Équipes équilibrées et âge')).toBe('equipes-equilibrees-et-age');
	});

	it('decodes entities before slugifying', () => {
		expect(slugify('Pairs & règles')).toBe('pairs-regles');
	});

	it('numbers duplicate headings', () => {
		const result = addHeadingIds('<h2>Même titre</h2><h2>Même titre</h2>');
		expect(result.html).toBe('<h2 id="meme-titre">Même titre</h2><h2 id="meme-titre-2">Même titre</h2>');
		expect(result.toc).toEqual([
			{ depth: 2, text: 'Même titre', id: 'meme-titre' },
			{ depth: 2, text: 'Même titre', id: 'meme-titre-2' }
		]);
	});

	it('maps Markdown links to generated pages', () => {
		const html = rewriteLinks('<a href="OPERATIONS.md#sauvegarde">Exploitation</a>', {
			slugs: new Map([['OPERATIONS.md', 'exploitation']]),
			repositoryUrl: 'https://github.com/SBK-Techno/ligue-hockey'
		});
		expect(html).toBe('<a href="exploitation.html#sauvegarde">Exploitation</a>');
	});

	it('sends code links to the repository', () => {
		const html = rewriteLinks('<a href="./config/env-schema.ts">Schéma</a>', {
			slugs: new Map(),
			repositoryUrl: 'https://github.com/SBK-Techno/ligue-hockey'
		});
		expect(html).toBe(
			'<a href="https://github.com/SBK-Techno/ligue-hockey/blob/main/config/env-schema.ts">Schéma</a>'
		);
	});

	it('leaves external links and generated assets alone', () => {
		const html = rewriteLinks(
			'<a href="https://example.com">Externe</a><img src="assets/crest.svg">',
			{
				slugs: new Map(),
				repositoryUrl: 'https://github.com/SBK-Techno/ligue-hockey'
			}
		);
		expect(html).toBe('<a href="https://example.com">Externe</a><img src="assets/crest.svg">');
	});

	it('escapes template values', () => {
		expect(escapeHtml('<script>"x"&</script>')).toBe(
			'&lt;script&gt;&quot;x&quot;&amp;&lt;/script&gt;'
		);
	});
});
