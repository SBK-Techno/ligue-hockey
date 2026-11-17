import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import GameRow from './GameRow.svelte';
import SeasonAgenda from './home/SeasonAgenda.svelte';

const game = {
	id: 'game-1',
	gameDate: '2026-11-15',
	startTime: '08:30',
	location: 'Complexe sportif de Sainte-Foy',
	status: 'scheduled' as const,
	availability: null,
	requestOpen: false,
	score: null
};

function locationLine(body: string): string {
	const spans = [...body.matchAll(/<span class="([^"]*)">([^<]*)<\/span>/g)];
	const line = spans.find((match) => match[2].includes(game.location));
	expect(line, 'ligne du lieu').toBeDefined();
	return line?.[1] ?? '';
}

describe('lieu complet dans une rangée étroite', () => {
	it('laisse la rangée de match envelopper le lieu à 320', () => {
		const { body } = render(GameRow, { props: { game } });
		const classes = locationLine(body);

		expect(classes).toContain('break-words');
		expect(classes).not.toContain('truncate');
	});

	it('laisse l’agenda envelopper le lieu à 320', () => {
		const { body } = render(SeasonAgenda, {
			props: { upcoming: [game], past: [] }
		});
		const classes = locationLine(body);

		expect(classes).toContain('break-words');
		expect(classes).not.toContain('truncate');
	});
});
