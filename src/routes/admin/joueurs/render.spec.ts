import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import type { AdminPlayer } from '#lib/domain/players/service.ts';

const page = vi.hoisted(() => ({
	url: new URL('https://ligue.test/admin/joueurs')
}));

vi.mock('$app/state', () => ({ page }));
vi.mock('$app/navigation', () => ({ replaceState: vi.fn() }));

const Page = (await import('./+page.svelte')).default;

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

const players: AdminPlayer[] = [
	{
		userId: 'player-1',
		firstName: 'Karim',
		lastName: 'Haddad',
		fullName: 'Karim Haddad',
		email: 'karim@example.test',
		age: 31,
		position: 'forward',
		jerseyNumber: 15,
		avatarId: null,
		isSubstitute: true,
		active: true,
		role: 'player'
	},
	{
		userId: 'player-2',
		firstName: 'Léa',
		lastName: 'Côté',
		fullName: 'Léa Côté',
		email: 'lea@example.test',
		age: 28,
		position: 'defense',
		jerseyNumber: 4,
		avatarId: null,
		isSubstitute: false,
		active: false,
		role: 'player'
	}
];

function renderAt(url: string): string {
	page.url = new URL(url);
	return render(Page, {
		props: {
			data: { ...layout, players, favorites: new Map<string, boolean>() },
			form: null,
			params: {}
		}
	}).body;
}

describe('liste des joueurs', () => {
	it('restaure la recherche et la puce depuis l’URL', () => {
		const body = renderAt('https://ligue.test/admin/joueurs?q=karim&filtre=subs');
		const input = body.match(/<input[^>]*id="player-search"[^>]*>/)?.[0] ?? '';
		const chips = [
			...body.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)
		];

		expect(input).toContain('value="karim"');
		expect(
			chips.some(
				(chip) =>
					chip[1] === 'true' && chip[2].includes(t('admin.filterSubs'))
			)
		).toBe(true);
		expect(body).toContain('Karim Haddad');
		expect(body).not.toContain('Léa Côté');
	});

	it('garde la rangée de recherche dans la largeur de la page', () => {
		const body = renderAt('https://ligue.test/admin/joueurs');
		const row = body.match(/<div class="([^"]*flex[^"]*)">\s*<label[^>]*player-search/)?.[1] ?? '';

		expect(row).toContain('w-full');
		expect(row).toContain('min-w-0');

		const css = readFileSync('src/routes/layout.css', 'utf8');
		const stack = css.slice(css.indexOf('.page-stack {'), css.indexOf('/* Une surface de lecture'));
		expect(stack).toContain('grid-template-columns: minmax(0, 1fr)');
	});
});
