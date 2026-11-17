import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
const avatar = readFileSync('src/lib/ui/Avatar.svelte', 'utf8');
const css = readFileSync('src/routes/layout.css', 'utf8');
const adminLayout = readFileSync('src/routes/admin/+layout.svelte', 'utf8');
const discussion = readFileSync('src/routes/discussion/+page.svelte', 'utf8');

describe('accessibilité des identités', () => {
	it('donne un texte de remplacement à l’image de partage', () => {
		expect(layout).toContain('property="og:image:alt"');
		expect(layout).toContain('name="twitter:image:alt"');
	});

	it('garde l’avatar décoratif par défaut, pour ne pas répéter le nom voisin', () => {
		expect(avatar).toMatch(/decorative = true/);
	});
});

describe('transition de page', () => {
	it('ne retient aucun transform après l’animation', () => {
		const block = css.slice(css.indexOf('.page-enter {'), css.indexOf('.reveal {'));
		expect(block).toContain('backwards');
		expect(block).not.toMatch(/\bboth\b/);
	});
});

describe('chrome fixe', () => {
	it('compose le décalage de base avec l’appoint déclaré de la surface', () => {
		const root = css.slice(css.indexOf('html {'), css.indexOf('body {'));

		expect(root).toContain(
			'scroll-padding-top: calc(var(--anchor-offset) + var(--surface-top-inset, 0px));'
		);
		expect(root).toContain(
			'scroll-padding-bottom: calc(var(--bottom-bar-offset) + var(--surface-bottom-inset, 0px));'
		);
	});

	it('garde le décalage du conteneur hors de chaque cible', () => {
		const offenders = globSync('src/**/*.svelte').filter((file) =>
			/scroll-mt-\[[^\]]*anchor-offset/.test(readFileSync(file, 'utf8'))
		);

		expect(offenders).toEqual([]);
	});

	it('garde un seul propriétaire pour la base du décalage', () => {
		const definitions = [...globSync('src/**/*.css'), ...globSync('src/**/*.svelte')].filter(
			(file) => /--anchor-offset\s*:/.test(readFileSync(file, 'utf8'))
		);

		expect(definitions).toEqual(['src/lib/ui/tokens.css']);
	});

	it('publie la hauteur mesurée de la sous-barre admin comme appoint haut', () => {
		expect(adminLayout).toContain('bind:clientHeight={subBarHeight}');
		expect(adminLayout).toContain("publishChromeInset('top', subBarHeight)");
		expect(adminLayout).not.toContain('style="--anchor-offset');
	});

	it('publie la hauteur mesurée du compositeur comme appoint bas', () => {
		expect(discussion).toContain('bind:clientHeight={composerHeight}');
		expect(discussion).toContain("publishChromeInset('bottom', composerHeight)");
	});
});
