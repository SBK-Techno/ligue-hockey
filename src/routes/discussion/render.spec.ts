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

	it('expose le numéro de chandail comme une image nommée', async () => {
		const { body } = await render(Page, { props: { data, form: null, params: {} } });

		expect(body).toContain('role="img"');
		expect(body).toContain(t('chat.jersey', { number: 15 }));
	});

	it('écrit un libellé de jour avec une majuscule', async () => {
		const { body } = await render(Page, { props: { data, form: null, params: {} } });

		expect(body).toContain('Lundi 5 janvier');
	});
});
