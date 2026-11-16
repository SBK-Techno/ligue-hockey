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
		class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
		aria-label={t('nav.mainMenu')}
	>
		<ul class="mx-auto flex max-w-lg items-stretch">
			{#each items as item (item.key)}
				{@const active = isActiveHref(path, item.href)}
				<li class="min-w-0 flex-1">
					<a
						href={item.href}
						class="relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 px-0.5 py-1.5 text-center no-underline {active
							? 'text-ink'
							: 'text-muted'}"
						aria-current={active ? 'page' : undefined}
					>
						{#if active}
							<span aria-hidden="true" class="absolute inset-x-2 top-0 h-[3px] bg-ochre"></span>
						{/if}
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
