<script lang="ts">
	import { page } from '$app/state';
	import { mobileSurfaces } from '#lib/domain/auth/surfaces.ts';
	import type { UserActor } from '#lib/domain/auth/types.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import NavIcon from '#lib/ui/NavIcon.svelte';
	import { isActiveHref } from '#lib/ui/nav.ts';

	let { actor }: { actor: UserActor } = $props();

	const path = $derived(page.url.pathname);
	const items = $derived(mobileSurfaces(actor));
</script>

{#if !path.startsWith('/admin')}
	<nav
		class="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 rounded-card border border-line bg-surface/95 shadow-lift backdrop-blur-md lg:hidden"
		aria-label={t('nav.mainMenu')}
	>
		<ul class="mx-auto flex max-w-lg items-stretch gap-1 p-1.5">
			{#each items as item (item.key)}
				{@const active = isActiveHref(path, item.href)}
				<li class="min-w-0 flex-1">
					<a
						href={item.href}
						class="flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-control px-0.5 py-1.5 text-center no-underline transition-colors {active
							? 'bg-ice-soft text-ice-deep'
							: 'text-muted hover:bg-ice-soft/50 hover:text-ice-deep'}"
						aria-current={active ? 'page' : undefined}
					>
						<NavIcon icon={item.icon} class="h-5 w-5" />
						<span
							class="max-w-full truncate text-[10px] font-semibold leading-tight tracking-tight"
							style="font-stretch: 92%"
						>
							{t(item.labelKey)}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
