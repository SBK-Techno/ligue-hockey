<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/shared/i18n/index.ts';

	let { children }: { children: import('svelte').Snippet } = $props();

	const tabs = [
		{ href: '/admin', key: 'admin.dashboard' as const },
		{ href: '/admin/joueurs', key: 'admin.players' as const },
		{ href: '/admin/matchs', key: 'admin.games' as const },
		{ href: '/admin/regles', key: 'admin.rules' as const },
		{ href: '/admin/soldes', key: 'admin.balances' as const },
		{ href: '/admin/parametres', key: 'admin.settings' as const }
	];

	function active(href: string): boolean {
		return href === '/admin'
			? page.url.pathname === '/admin'
			: page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<nav
	class="mb-6 flex gap-1 overflow-x-auto border-b border-line/80 pb-2"
	aria-label={t('nav.admin')}
>
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold no-underline transition-colors {active(
				tab.href
			)
				? 'bg-ice text-white'
				: 'text-muted hover:bg-ink/5 hover:text-ink'}"
			aria-current={active(tab.href) ? 'page' : undefined}
		>
			{t(tab.key)}
		</a>
	{/each}
</nav>

{@render children()}
