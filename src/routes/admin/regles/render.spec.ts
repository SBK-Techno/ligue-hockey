import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { AdminPlayer } from '#lib/domain/players/service.ts';
import type { PairRuleView } from '#lib/domain/rules/service.ts';
import { t } from '#lib/shared/i18n/index.ts';
import Page from './+page.svelte';

const layout = {
	actor: {
		kind: 'user' as const,
		active: true,
		userId: 'manager',
		name: 'Gérant',
		role: 'manager' as const
	},
	unread: 0,
	hasPlayerProfile: true,
	isSubstitute: false,
	avatarId: null,
	peekScope: 'public' as const,
	nav: {
		primary: [],
		mobile: [],
		account: null,
		roleLabelKey: 'admin.role.manager' as const,
		unreadCap: 9 as const
	}
};

function player(userId: string, firstName: string, lastName: string): AdminPlayer {
	return {
		userId,
		firstName,
		lastName,
		fullName: `${firstName} ${lastName}`,
		position: 'forward',
		jerseyNumber: 10,
		avatarId: null,
		isSubstitute: false,
		active: true,
		email: `${userId}@example.test`,
		age: 35,
		role: 'player'
	};
}

const players = [
	player('player-a', 'Ibrahim', 'Traoré'),
	player('player-b', 'Chidi', 'Okonkwo'),
	player('player-c', 'Samuel', 'Tremblay')
];

const rules: PairRuleView[] = [
	{ id: 'rule-1', playerAId: 'player-a', playerBId: 'player-b', mode: 'together' },
	{ id: 'rule-2', playerAId: 'player-a', playerBId: 'player-c', mode: 'apart' }
];

function renderPage() {
	return render(Page, {
		props: {
			data: { ...layout, players, rules },
			form: null,
			params: {}
		}
	});
}

describe('règles d’alignement', () => {
	it('donne à chaque suppression un nom qui nomme sa paire', () => {
		const { body } = renderPage();
		const labels = [...body.matchAll(/<button[^>]*aria-label="([^"]*)"[^>]*>Supprimer/g)].map(
			(match) => match[1]
		);

		expect(labels).toHaveLength(2);
		expect(new Set(labels).size).toBe(2);
		expect(labels[0]).toContain('Ibrahim Traoré');
		expect(labels[0]).toContain('Chidi Okonkwo');
		expect(labels[0]).toBe(
			t('admin.deleteRuleNamed', { names: 'Ibrahim Traoré · Chidi Okonkwo' })
		);
	});
});
