import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isPublished } from './published.ts';

/**
 * « Publié » est une seule règle : les deux colonnes de la génération existent
 * ensemble. Les lecteurs qui n'en vérifiaient qu'une moitié partagent
 * désormais ce prédicat; une ligne à moitié écrite ne peut plus être publiée.
 */
describe('match publié', () => {
	it.each<[string, { generatedAt: number | null; generationJson: string | null }, boolean]>([
		['les deux colonnes', { generatedAt: 1, generationJson: '{}' }, true],
		['aucune colonne', { generatedAt: null, generationJson: null }, false],
		['seulement la date', { generatedAt: 1, generationJson: null }, false],
		['seulement le JSON', { generatedAt: null, generationJson: '{}' }, false]
	])('%s : publié = %s', (_label, row, published) => {
		expect(isPublished(row)).toBe(published);
	});

	it('ne laisse aucun consommateur refaire le prédicat', () => {
		const readers = [
			new URL('./queries.ts', import.meta.url),
			new URL('./lineup.ts', import.meta.url),
			new URL('./upcoming.ts', import.meta.url),
			new URL('./service.ts', import.meta.url),
			new URL('../ratings/queries.ts', import.meta.url)
		];
		const partial = /generatedAt\s*(===|!==)\s*null|generationJson\s*(===|!==)\s*null/;

		for (const reader of readers) {
			const source = readFileSync(reader, 'utf8');
			expect(source, reader.pathname).toContain('isPublished');
			expect(source, reader.pathname).not.toMatch(partial);
		}
	});
});
