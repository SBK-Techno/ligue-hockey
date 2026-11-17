import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Un menu ouvert vit dans une rangée qui porte `z-20`. La règle d'état doit
 * donc appartenir à la couche des utilitaires, après leur génération : dans
 * `components`, la classe utilitaire gagne et le menu passe sous la rangée
 * suivante. Ce contrat lit la feuille réelle, pas une copie.
 */
describe('empilement des menus', () => {
	it('place la règle du menu ouvert dans la couche des utilitaires', () => {
		const css = readFileSync('src/routes/layout.css', 'utf8');
		const utilities = css.indexOf('@layer utilities');
		const rule = css.indexOf('details[open]:has(> .sheet)');

		expect(utilities).toBeGreaterThan(0);
		expect(rule).toBeGreaterThan(utilities);
		expect(css.slice(rule, rule + 120)).toContain('z-index: 30');
	});

	it('garde le menu dans une feuille directe du disclosure', () => {
		const page = readFileSync('src/routes/admin/joueurs/+page.svelte', 'utf8');
		const details = page.slice(
			page.indexOf('<details class="group relative z-20'),
			page.indexOf('</details>', page.indexOf('<details class="group relative z-20'))
		);

		expect(details).toContain('class="sheet absolute right-0');
		expect(details).toContain("menuUp");
	});
});
