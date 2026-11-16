<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ADMIN_TABS } from '#config/admin-tabs.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import { isActiveHref } from '#lib/ui/nav.ts';

	let {
		data,
		children
	}: { data: import('./$types').LayoutData; children: import('svelte').Snippet } = $props();

	const tabs = $derived(ADMIN_TABS.filter((tab) => can(data.actor, tab.capability)));

	function active(href: string): boolean {
		return isActiveHref(page.url.pathname, href, href === '/admin');
	}

	const selected = $derived(tabs.find((tab) => active(tab.href))?.href ?? tabs[0]?.href ?? '/admin');
</script>

<div
	class="lg:grid lg:grid-cols-[11.5rem_minmax(0,1fr)] lg:gap-8"
	style="--anchor-offset: calc(3.75rem + 3.5rem + env(safe-area-inset-top) + 0.75rem)"
>
	<aside
		class="hidden lg:sticky lg:top-[calc(3.75rem+1px+env(safe-area-inset-top)+1rem)] lg:block lg:border-r lg:border-line lg:pr-4"
	>
		<div class="py-1">
			<p class="serial px-2.5 pb-2">{t('admin.title')}</p>
			<nav class="flex flex-col" aria-label={t('nav.admin')}>
				{#each tabs as tab (tab.href)}
					{@const current = active(tab.href)}
					<a
						href={tab.href}
						class="relative flex min-h-11 items-center border-l-[3px] px-2.5 text-[13px] font-medium no-underline transition-colors {current
							? 'border-ochre bg-ink/[0.04] text-ink'
							: 'border-transparent text-muted hover:bg-ink/5 hover:text-ink'}"
						aria-current={current ? 'page' : undefined}
					>
						{t(tab.labelKey)}
					</a>
				{/each}
			</nav>
			<div class="mt-3 border-t border-line pt-2">
				<a
					href="/"
					class="flex min-h-11 items-center gap-2 px-2.5 text-sm font-medium text-muted no-underline hover:bg-ink/5 hover:text-ink"
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
		<div
			class="sticky top-[calc(3.75rem+1px+env(safe-area-inset-top))] z-20 -mx-4 mb-5 flex items-center gap-2 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur lg:hidden"
		>
			<a
				href="/"
				class="grid h-11 w-11 shrink-0 place-items-center text-muted no-underline"
				aria-label={t('nav.backToLeague')}
				title={t('nav.backToLeague')}
			>
				<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path d="m15 6-6 6 6 6" />
				</svg>
			</a>
			<label class="sr-only" for="admin-nav">{t('nav.admin')}</label>
			<select
				id="admin-nav"
				class="input min-h-11 flex-1 py-1.5 font-semibold"
				value={selected}
				aria-label={t('nav.admin')}
				onchange={(event) => goto(event.currentTarget.value)}
			>
				{#each tabs as tab (tab.href)}
					<option value={tab.href}>{t(tab.labelKey)}</option>
				{/each}
			</select>
		</div>
		{@render children()}
	</div>
</div>
