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

	it('garde la légende des routes d’authentification dans un repère', () => {
		const authBody = layout.slice(layout.indexOf('class="auth-body"'), layout.indexOf('{:else}'));

		expect(authBody).toContain('<footer class="auth-caption">');
		expect(authBody).not.toContain('<p class="auth-caption">');
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

describe('composition de la coquille', () => {
	it('colle le pied de page au bas d’une page courte sans le superposer au contenu', () => {
		const shell = css.slice(css.indexOf('.app-shell {'), css.indexOf('.page-ground {'));

		expect(shell).toContain('display: flex');
		expect(shell).toContain('flex-direction: column');
		expect(shell).toContain('min-height: 100dvh');
		expect(css).toContain('.app-shell > main {');
		expect(css.slice(css.indexOf('.app-shell > main {'))).toContain('flex: 1 0 auto');
		expect(layout).toContain('<footer');
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
