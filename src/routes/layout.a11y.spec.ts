import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
const avatar = readFileSync('src/lib/ui/Avatar.svelte', 'utf8');
const css = readFileSync('src/routes/layout.css', 'utf8');

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
	it('réserve le décalage du contenu ciblé sous l’en-tête et la barre', () => {
		const root = css.slice(css.indexOf('html {'), css.indexOf('body {'));

		expect(root).toContain('scroll-padding-top: var(--anchor-offset);');
		expect(root).toContain('scroll-padding-bottom: var(--bottom-bar-offset);');
	});
});
