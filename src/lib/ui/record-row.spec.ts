import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import RecordRow from './RecordRow.svelte';

describe('rangée de registre', () => {
	it('garde le lieu complet quand la colonne est étroite', () => {
		const { body } = render(RecordRow, {
			props: {
				href: '/admin/matchs/game-1',
				title: '8 h 30 · Complexe sportif de Sainte-Foy',
				meta: '15 nov.'
			}
		});

		expect(body).toContain('8 h 30 · Complexe sportif de Sainte-Foy');
		expect(body).toContain('15 nov.');
		expect(body).not.toContain('truncate');
	});
});
