import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';

import Page from './+page.svelte';

const createdAt = 1767614400000;

const data = {
	actor: { kind: 'user' as const, active: true, userId: 'player', name: 'Joueur', role: 'player' as const },
	unread: 0,
	hasPlayerProfile: true,
	isSubstitute: false,
	avatarId: null,
	peekScope: 'public' as const,
	nav: {
		primary: [],
		mobile: [],
		account: null,
		roleLabelKey: 'admin.role.player' as const,
		unreadCap: 9 as const
	},
	messages: [
		{
			id: 'message-1',
			authorUserId: 'player-1',
			authorName: 'Karim Haddad',
			authorAvatarId: null,
			authorJerseyNumber: 15,
			authorPosition: 'forward' as const,
			isOwn: false,
			kind: 'text' as const,
			body: 'Salut la gang',
			createdAt,
			deleted: false,
			poll: null,
			canDelete: false
		}
	],
	nextCursor: null,
	before: null,
	limits: {
		messageMax: 2000,
		questionMax: 200,
		optionMax: 120,
		pollMinOptions: 2,
		pollMaxOptions: 6
	} as const,
	canCreatePoll: false,
	today: '2026-11-15',
	yesterday: '2026-11-14'
};

describe('page de discussion', () => {
	it('garde l’avis de nouveaux messages après la liste, pas avant l’en-tête', async () => {
		const { body } = await render(Page, { props: { data, form: null, params: {} } });

		expect(body.indexOf('Salut la gang')).toBeGreaterThan(0);
		expect(body.indexOf('role="status"')).toBeGreaterThan(body.indexOf('Salut la gang'));
		expect(body.indexOf('action="?/send"')).toBeGreaterThan(body.indexOf('role="status"'));
	});

	it('donne un nom unique au menu de chaque message', async () => {
		const messages = [
			{ ...data.messages[0], id: 'message-a', authorName: 'Karim Haddad', body: 'Salut la gang' },
			{ ...data.messages[0], id: 'message-b', authorName: 'Karim Haddad', body: 'On joue à 20 h' },
			{ ...data.messages[0], id: 'message-c', authorName: 'Léa Côté', body: 'Salut la gang' }
		].map((message) => ({ ...message, canDelete: true }));
		const { body } = await render(Page, {
			props: { data: { ...data, messages }, form: null, params: {} }
		});
		const names = [...body.matchAll(/<summary[^>]*aria-label="([^"]*)"/g)].map(
			(match) => match[1]
		);

		expect(names).toHaveLength(3);
		expect(new Set(names).size).toBe(3);
		for (const message of messages) {
			expect(names).toContain(
				t('chat.messageActionsName', {
					author: message.authorName,
					excerpt: message.body
				})
			);
		}
	});

	it('expose le numéro de chandail comme une image nommée', async () => {
		const { body } = await render(Page, { props: { data, form: null, params: {} } });

		expect(body).toContain('role="img"');
		expect(body).toContain(t('chat.jersey', { number: 15 }));
	});

	it('écrit un libellé de jour avec une majuscule', async () => {
		const { body } = await render(Page, { props: { data, form: null, params: {} } });

		expect(body).toContain('Lundi 5 janvier');
	});

	it('borne la liste et le composeur dans une seule colonne', async () => {
		const { body } = await render(Page, { props: { data, form: null, params: {} } });
		const start = body.indexOf('mx-auto w-full max-w-3xl');
		const openEnd = body.indexOf('>', start) + 1;
		const sheet = body.indexOf('<section class="sheet"');
		const composer = body.indexOf('action="?/send"');

		expect(start).toBeGreaterThan(-1);
		expect(sheet).toBeGreaterThanOrEqual(openEnd);
		expect(composer).toBeGreaterThan(sheet);

		// La colonne reste ouverte jusqu'au composeur : aucun </div> ne la ferme.
		let depth = 0;
		for (const tag of body.slice(openEnd, composer).matchAll(/<div\b|<\/div>/g)) {
			depth += tag[0] === '<div' ? 1 : -1;
			expect(depth, tag[0]).toBeGreaterThanOrEqual(0);
		}

		expect(body.match(/\bmax-w-3xl\b/g)).toHaveLength(1);
		expect(body.split(t('chat.writeTitle'))).toHaveLength(2);
		const sendForm = body.match(/<form[^>]*action="\?\/send"[^>]*>/)?.[0] ?? '';
		expect(sendForm).toContain(`aria-label="${t('chat.writeTitle')}"`);
	});

	it('ouvre la fiche de l’auteur au clavier depuis son avatar', async () => {
		const { body } = await render(Page, { props: { data, form: null, params: {} } });
		const trigger = body.match(/<span[^>]*data-player-id="player-1"[^>]*>/)?.[0] ?? '';

		expect(trigger).toContain('role="button"');
		expect(trigger).toContain('tabindex="0"');
		expect(trigger).toContain('aria-haspopup="dialog"');
		expect(trigger).toContain('aria-expanded="false"');
		expect(trigger).not.toContain('aria-hidden="true"');
	});
});
