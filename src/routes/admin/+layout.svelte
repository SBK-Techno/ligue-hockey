<script lang="ts">
	import { page } from '$app/state';
	import { can } from '#lib/domain/auth/policy.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		data,
		children
	}: { data: import('./$types').LayoutData; children: import('svelte').Snippet } = $props();

	const allTabs = [
		{ href: '/admin', key: 'admin.dashboard' as const, capability: 'viewAdmin' as const },
		{ href: '/admin/joueurs', key: 'admin.players' as const, capability: 'managePlayers' as const },
		{ href: '/admin/matchs', key: 'admin.games' as const, capability: 'manageGames' as const },
		{ href: '/admin/regles', key: 'admin.rules' as const, capability: 'manageRules' as const },
		{ href: '/admin/soldes', key: 'admin.balances' as const, capability: 'viewAllBalances' as const },
		{ href: '/admin/parametres', key: 'admin.settings' as const, capability: 'manageSettings' as const }
	];
	const tabs = $derived(allTabs.filter((tab) => can(data.actor, tab.capability)));

	function active(href: string): boolean {
		return href === '/admin'
			? page.url.pathname === '/admin'
			: page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<div class="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-8">
	<aside class="hidden lg:sticky lg:top-24 lg:block">
		<div class="rounded-card border border-line bg-surface p-3 shadow-card">
			<p class="px-2 pb-2 pt-1 font-display text-sm font-bold">{t('admin.title')}</p>
			<nav class="flex flex-col gap-0.5" aria-label={t('nav.admin')}>
				{#each tabs as tab (tab.href)}
					<a
						href={tab.href}
						class="rounded-control px-2.5 py-2 text-sm font-semibold no-underline transition-colors {active(
							tab.href
						)
							? 'bg-ink text-paper'
							: 'text-muted hover:bg-ink/5 hover:text-ink'}"
						aria-current={active(tab.href) ? 'page' : undefined}
					>
						{t(tab.key)}
					</a>
				{/each}
			</nav>
			<div class="mt-3 border-t border-line/80 pt-2">
				<a
					href="/"
					class="flex items-center gap-2 rounded-control px-2.5 py-2 text-sm font-medium text-muted no-underline hover:bg-ink/5 hover:text-ink"
				>
					<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<path d="m15 6-6 6 6 6" />
					</svg>
					{t('nav.backToLeague')}
				</a>
			</div>
		</div>
	</aside>

	<div class="min-w-0">
		<nav
			class="mb-6 flex flex-wrap gap-1 border-b border-line/80 pb-2 lg:hidden"
			aria-label={t('nav.admin')}
		>
			{#each tabs as tab (tab.href)}
				<a
					href={tab.href}
					class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold no-underline transition-colors {active(
						tab.href
					)
						? 'bg-ice text-on-brand'
						: 'text-muted hover:bg-ink/5 hover:text-ink'}"
					aria-current={active(tab.href) ? 'page' : undefined}
				>
					{t(tab.key)}
				</a>
			{/each}
		</nav>
		{@render children()}
	</div>
</div>
