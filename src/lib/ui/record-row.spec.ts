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

	it('garde le titre dans son corps et groupe l’état, le montant et la flèche', () => {
		const { body } = render(RecordRow, {
			props: {
				href: '/admin/joueurs/demo_user_03#solde',
				title: 'Pierre-Luc Gauthier',
				meta: 'Payé 0,00 $ sur 240,00 $',
				badge: 'En retard',
				trailing: '123,45 $'
			}
		});

		const bodyStart = body.indexOf('record-body');
		const tailStart = body.indexOf('record-tail');

		expect(bodyStart).toBeGreaterThan(-1);
		expect(tailStart).toBeGreaterThan(bodyStart);
		expect(body.indexOf('Pierre-Luc Gauthier')).toBeGreaterThan(bodyStart);
		expect(body.indexOf('Pierre-Luc Gauthier')).toBeLessThan(tailStart);
		expect(body.indexOf('En retard')).toBeGreaterThan(tailStart);
		expect(body.indexOf('123,45 $')).toBeGreaterThan(tailStart);
		expect(body.indexOf('<svg', tailStart)).toBeGreaterThan(tailStart);
	});

	it('n’ajoute pas de groupe de fin quand la rangée n’a rien à droite', () => {
		const { body } = render(RecordRow, {
			props: { title: 'Pierre-Luc Gauthier' }
		});

		expect(body).not.toContain('record-tail');
	});

	it('garde une flèche seule sur la même ligne que le titre', () => {
		const { body } = render(RecordRow, {
			props: { href: '/admin/soldes', title: 'Pierre-Luc Gauthier' }
		});

		expect(body).toContain('record-tail');
		expect(body).toContain('data-compact="true"');
	});
});
