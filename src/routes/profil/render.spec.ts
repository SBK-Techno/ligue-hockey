import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { PLAYER_LIMITS } from '#config/players.ts';
import { t } from '#lib/shared/i18n/index.ts';
import Page from './+page.svelte';

const layout = {
	actor: {
		kind: 'user' as const,
		active: true,
		userId: 'player',
		name: 'Joueur Test',
		role: 'player' as const
	},
	unread: 0,
	hasPlayerProfile: false,
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

function renderPage() {
	return render(Page, {
		props: {
			data: {
				...layout,
				account: {
					id: 'player',
					name: 'Joueur Test',
					email: 'joueur@example.test',
					role: 'player' as const,
					createdAt: 1_700_000_000_000
				},
				profile: null,
				avatarPicker: null,
				positions: [],
				notifications: { emailEnabled: true, pushEnabled: false },
				stats: null,
				balance: null,
				sessions: [],
				currentSessionId: null,
				vapidPublicKey: null,
				minLength: 8,
				limits: {
					nameMax: PLAYER_LIMITS.nameMax,
					ageMin: PLAYER_LIMITS.ageMin,
					ageMax: PLAYER_LIMITS.ageMax,
					jerseyMin: PLAYER_LIMITS.jerseyMin,
					jerseyMax: PLAYER_LIMITS.jerseyMax,
					jerseyExample: PLAYER_LIMITS.jerseyExample
				},
				legend: null,
				nav: {
					canViewAdmin: false,
					canSeeRatings: false,
					canManagePlayers: false,
					managementLinks: [],
					roleLabelKey: 'admin.role.player' as const
				}
			},
			form: null,
			params: {}
		}
	});
}

describe('sections du profil', () => {
	it('ne prétend pas connaître la section avant le client', async () => {
		const { body } = await renderPage();
		const start = body.indexOf(`aria-label="${t('profile.sections')}"`);
		const nav = body.slice(start, body.indexOf('</nav>', start));

		expect(start).toBeGreaterThan(-1);
		expect(nav).not.toContain('aria-current');
	});

	it('garde le compte, les avis et la sécurité dans cet ordre', async () => {
		const { body } = await renderPage();
		const start = body.indexOf(`aria-label="${t('profile.sections')}"`);
		const nav = body.slice(start, body.indexOf('</nav>', start));
		const account = nav.indexOf(t('profile.tab.account'));
		const notifications = nav.indexOf(t('profile.tab.notifications'));
		const security = nav.indexOf(t('profile.tab.security'));

		expect(account).toBeGreaterThan(-1);
		expect(account).toBeLessThan(notifications);
		expect(notifications).toBeLessThan(security);
	});
});
