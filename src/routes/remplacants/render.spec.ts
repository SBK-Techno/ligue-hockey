import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import Page from './+page.svelte';

function renderPage(isSubstitute: boolean) {
	return render(Page, {
		props: {
			data: {
				actor: { kind: 'user', active: true, userId: 'player', name: 'Joueur', role: 'player' },
				unread: 0,
				hasPlayerProfile: true,
				avatarId: null,
				peekScope: 'public',
				nav: {
					primary: [],
					mobile: [],
					account: null,
					roleLabelKey: 'admin.role.player',
					unreadCap: 9 as const
				},
				requests: [],
				pool: [],
				positions: [],
				games: [],
				isSubstitute,
				canManageRequests: false,
				canManagePool: false,
				canManageGames: false
			},
			form: null,
			params: {}
		}
	});
}

describe('état d’un joueur qui n’est pas remplaçant', () => {
	it('nomme la prochaine étape au lieu de s’arrêter sur le constat', () => {
		const { body } = renderPage(false);

		expect(body).toContain(t('subs.notInPool'));
		expect(body).toContain(t('subs.notInPoolHelp'));
	});

	it('ne montre pas cette étape à un remplaçant', () => {
		const { body } = renderPage(true);

		expect(body).not.toContain(t('subs.notInPoolHelp'));
	});
});
