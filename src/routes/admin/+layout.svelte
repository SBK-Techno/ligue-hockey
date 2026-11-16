<script lang="ts">
	import { page } from '$app/state';
	import { ADMIN_TABS } from '#config/admin-tabs.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		data,
		children
	}: { data: import('./$types').LayoutData; children: import('svelte').Snippet } = $props();

	const tabs = $derived(ADMIN_TABS.filter((tab) => can(data.actor, tab.capability)));

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
					{@const current = active(tab.href)}
					<a
						href={tab.href}
						class="relative flex min-h-11 items-center rounded-control px-2.5 text-sm font-semibold no-underline transition-colors {current
							? 'text-ink'
							: 'text-muted hover:bg-ink/5 hover:text-ink'}"
						aria-current={current ? 'page' : undefined}
					>
						{t(tab.labelKey)}
						{#if current}
							<span
								aria-hidden="true"
								class="absolute inset-y-2 left-0 w-0.5 rounded-full bg-ice"
							></span>
						{/if}
					</a>
				{/each}
			</nav>
			<div class="mt-3 border-t border-line/80 pt-2">
				<a
					href="/"
					class="flex min-h-11 items-center gap-2 rounded-control px-2.5 text-sm font-medium text-muted no-underline hover:bg-ink/5 hover:text-ink"
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
				{@const current = active(tab.href)}
				<a
					href={tab.href}
					class="relative flex min-h-11 items-center whitespace-nowrap rounded-control px-3 text-sm font-semibold no-underline transition-colors {current
						? 'text-ink'
						: 'text-muted hover:bg-ink/5 hover:text-ink'}"
					aria-current={current ? 'page' : undefined}
				>
					{t(tab.labelKey)}
					{#if current}
						<span
							aria-hidden="true"
							class="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-ice"
						></span>
					{/if}
				</a>
			{/each}
		</nav>
		{@render children()}
	</div>
</div>
