<script lang="ts">
	import { page } from '$app/state';
	import type { Surface } from '#config/surfaces.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import NavIcon from '#lib/ui/NavIcon.svelte';
	import { isActiveHref, mobileNavLabelKey } from '#lib/ui/nav.ts';

	let { items }: { items: readonly Surface[] } = $props();

	const path = $derived(page.url.pathname);
</script>

{#if !path.startsWith('/admin')}
	<nav
		class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
		aria-label={t('nav.mainMenu')}
	>
		<ul class="mx-auto flex max-w-lg items-stretch px-2 pt-1">
			{#each items as item (item.key)}
				{@const active = isActiveHref(path, item.href)}
				<li class="min-w-0 flex-1">
					<a
						href={item.href}
						class="relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 px-0.5 py-1.5 text-center no-underline transition-colors {active
							? 'text-ink'
							: 'text-muted hover:text-ink'}"
						aria-current={active ? 'page' : undefined}
					>
						{#if active}
							<span class="absolute inset-x-3 top-0 h-0.5 bg-ice" aria-hidden="true"></span>
						{/if}
						<NavIcon icon={item.icon} class="h-5 w-5" />
						<span class="max-w-full truncate text-caption font-semibold leading-tight">
							{t(mobileNavLabelKey(item))}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
