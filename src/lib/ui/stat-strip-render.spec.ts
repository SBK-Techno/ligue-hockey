import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import StatStrip from './StatStrip.svelte';
import ManagerPanel from './home/ManagerPanel.svelte';

const cells = Array.from({ length: 5 }, (_, index) => ({
	label: `Mesure ${index + 1}`,
	value: index + 1
}));

function cellCount(body: string): number {
	return body.match(/class="metric-cell"/g)?.length ?? 0;
}

describe('bandeau de chiffres', () => {
	it.each([3, 5])('déclare ses %i cellules pour que la dernière occupe la ligne', (count) => {
		const { body } = render(StatStrip, { props: { cells: cells.slice(0, count) } });

		expect(body).toContain(`data-cells="${count}"`);
		expect(cellCount(body)).toBe(count);
	});

	it('donne à une seule cellule sa largeur de contenu', () => {
		const { body } = render(StatStrip, { props: { cells: cells.slice(0, 1) } });
		const css = readFileSync(new URL('../../routes/layout.css', import.meta.url), 'utf8');
		const flat = css.replace(/\s+/g, ' ');

		expect(body).toContain('data-cells="1"');
		expect(flat).toContain(".metric-strip[data-cells='1']");
		expect(flat).toContain('width: fit-content');
		expect(flat).toContain(
			".metric-strip:not([data-cells='1']) .metric-cell:last-child:nth-child(odd)"
		);
		expect(flat).toContain('grid-column: span 2');
	});

	it('répond à la largeur de son contenant, pas à celle de la fenêtre', () => {
		const { body } = render(StatStrip, { props: { cells } });
		const css = readFileSync(new URL('../../routes/layout.css', import.meta.url), 'utf8');

		expect(body).toContain('class="metric-strip-wrap"');
		expect(css).toContain('.metric-strip-wrap {\n\t\tcontainer-type: inline-size;');
		expect(css).toContain('@container (max-width: 40rem)');
		expect(css).not.toContain('@media (max-width: 700px)');
	});

	it('porte ses libellés à 12 px et ses tampons à 11 px', () => {
		const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

		expect(tokens).toContain('--text-caption: 0.75rem;');
		expect(tokens).toContain('--text-stamp: 0.6875rem;');
	});
});

describe('panneau du responsable', () => {
	it('montre toujours les présents, les absents et les sans-réponse', () => {
		const { body } = render(ManagerPanel, {
			props: {
				summary: { openSlots: 3, present: 8, absent: 2, unknown: 1, generated: true },
				gameId: 'game-1',
				gameDate: '2026-11-15',
				startTime: '08:30',
				location: 'Complexe sportif de Sainte-Foy'
			}
		});

		expect(body).toContain('data-cells="4"');
		expect(body).toContain(t('home.present'));
		expect(body).toContain(t('home.absent'));
		expect(body).toContain(t('availability.noAnswer'));
		expect(cellCount(body)).toBe(4);
	});
});
