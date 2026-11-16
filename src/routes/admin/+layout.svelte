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

<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
	<div>
		<p class="font-display text-xs font-bold uppercase tracking-[0.2em] text-ice">{t('nav.admin')}</p>
		<h1 class="mt-1">{t('admin.title')}</h1>
	</div>
</div>

<nav class="mb-5 flex gap-1 overflow-x-auto pb-1" aria-label={t('nav.admin')}>
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold no-underline {active(
				tab.href
			)
				? 'bg-ink text-paper'
				: 'text-muted hover:bg-surface hover:text-ink'}"
			aria-current={active(tab.href) ? 'page' : undefined}
		>
			{t(tab.key)}
		</a>
	{/each}
</nav>

{@render children()}
