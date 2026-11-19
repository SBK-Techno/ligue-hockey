import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

describe('clé de la carte d’alignement', () => {
	it('remonte la carte quand la partie change, pas seulement la génération', () => {
		// Le bouton « prochain match » navigue sur la même route : Kit garde
		// la page montée. Deux parties générées dans la même milliseconde
		// partageraient un generatedAt identique ; l'identifiant de la partie
		// lève la collision et garantit un état neuf par partie.
		expect(source).toContain('{#key `${game.id}:${game.generation?.generatedAt}`}');
	});
});
