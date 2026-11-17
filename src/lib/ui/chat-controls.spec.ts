import { describe, expect, it } from 'vitest';
import { t } from '#lib/shared/i18n/index.ts';
import { chatControlName } from './chat-controls.ts';

describe('noms des commandes de discussion', () => {
	it('distingue trois messages par leur auteur et leur extrait', () => {
		const names = [
			chatControlName({ kind: 'message', author: 'Karim Haddad', body: 'Salut la gang' }),
			chatControlName({ kind: 'message', author: 'Karim Haddad', body: 'On joue à 20 h' }),
			chatControlName({ kind: 'message', author: 'Léa Côté', body: 'Salut la gang' })
		];

		expect(new Set(names).size).toBe(3);
		expect(names[0]).toBe(
			t('chat.messageActionsName', {
				author: 'Karim Haddad',
				excerpt: 'Salut la gang'
			})
		);
	});

	it('nomme le message d’un sondage par sa question', () => {
		const name = chatControlName({
			kind: 'message',
			author: 'Léa Côté',
			body: null,
			question: 'Quel soir pour la pratique ?'
		});

		expect(name).toContain('Quel soir pour la pratique ?');
	});

	it('distingue trois choix de sondage par leur numéro', () => {
		const names = [0, 1, 2].map((index) =>
			chatControlName({ kind: 'pollOption', index })
		);

		expect(names).toEqual([
			t('chat.optionDelete', { number: 1 }),
			t('chat.optionDelete', { number: 2 }),
			t('chat.optionDelete', { number: 3 })
		]);
		expect(new Set(names).size).toBe(3);
	});

	it('borne un extrait long par des points de suspension', () => {
		const name = chatControlName({
			kind: 'message',
			author: 'Karim Haddad',
			body: 'a'.repeat(200)
		});

		expect(name.length).toBeLessThan(120);
		expect(name).toContain('…');
	});
});
