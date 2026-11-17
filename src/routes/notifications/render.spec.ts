import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { InboxItem } from '#lib/domain/notifications/service.ts';
import { t } from '#lib/shared/i18n/index.ts';
import Page from './+page.svelte';

const layout = {
	actor: { kind: 'user' as const, active: true, userId: 'player', name: 'Joueur', role: 'player' as const },
	unread: 1,
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
	}
};

const items: InboxItem[] = [
	{
		id: 'unread',
		eventKey: 'game.reminder',
		title: 'Match demain',
		body: 'Le match commence à 9 h.',
		url: '/matchs/game-1',
		createdAt: 1_760_000_000_000,
		readAt: null
	},
	{
		id: 'read',
		eventKey: 'balance.reminder',
		title: 'Solde à payer',
		body: 'Il reste un versement.',
		url: '/solde',
		createdAt: 1_759_000_000_000,
		readAt: 1_759_500_000_000
	}
];

function renderPage(overrides: Partial<typeof layout> = {}) {
	return render(Page, {
		props: {
			data: { ...layout, ...overrides, items, nextCursor: null, before: null },
			form: null,
			params: {}
		}
	});
}

describe('boîte de notifications', () => {
	it('marque le nouvel avis dans le fil, une seule fois, et laisse le lu sans tampon', () => {
		const { body } = renderPage();
		const stamps = body.match(new RegExp(t('notifications.unread'), 'g')) ?? [];
		const unreadTitle = body.indexOf('Match demain');
		const stamp = body.indexOf(t('notifications.unread'));
		const readTitle = body.indexOf('Solde à payer');

		expect(stamps).toHaveLength(1);
		expect(unreadTitle).toBeGreaterThan(-1);
		expect(stamp).toBeGreaterThan(unreadTitle);
		expect(readTitle).toBeGreaterThan(stamp);
	});

	it('garde tout marquer comme lu en second plan et explique la page', () => {
		const { body } = renderPage();
		const button =
			body.match(new RegExp(`<button[^>]*>${t('notifications.markAll')}`))?.[0] ?? '';

		expect(body).toContain(t('notifications.help'));
		expect(button).toContain('btn-secondary');
		expect(button).not.toContain('btn-primary');
	});
});
