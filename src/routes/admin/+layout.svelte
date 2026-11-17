<script lang="ts">
	import { page } from '$app/state';
	import { ADMIN_TABS } from '#config/admin-tabs.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import { publishChromeInset } from '#lib/ui/chrome-inset.svelte.ts';
	import { isActiveHref } from '#lib/ui/nav.ts';

	let {
		data,
		children
	}: { data: import('./$types').LayoutData; children: import('svelte').Snippet } = $props();

	const tabs = $derived(ADMIN_TABS.filter((tab) => can(data.actor, tab.capability)));

	function active(href: string): boolean {
		return isActiveHref(page.url.pathname, href, href === '/admin');
	}

	// La sous-barre mobile recouvre le document sous l'en-tête : sa hauteur
	// mesurée rejoint l'unique décalage composé par `layout.css`.
	let subBarHeight = $state(0);
	let mobileNav = $state<HTMLElement | null>(null);

	$effect(() => {
		publishChromeInset('top', subBarHeight);
		return () => publishChromeInset('top', 0);
	});

	// La destination active reste visible dans la bande horizontale.
	$effect(() => {
		void page.url.pathname;
		mobileNav?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({
			block: 'nearest',
			inline: 'nearest'
		});
	});
</script>

{#snippet backToLeague(label: string, className: string)}
	<a href="/" class={className}>
		<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="m15 6-6 6 6 6" />
		</svg>
		<span>{label}</span>
	</a>
{/snippet}

<div class="lg:grid lg:grid-cols-[11.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
	<aside
		class="hidden lg:sticky lg:top-[calc(3.75rem+1px+env(safe-area-inset-top)+1rem)] lg:block lg:border-r lg:border-line lg:pr-4"
	>
		<div class="py-1">
			{@render backToLeague(
				t('nav.backToLeague'),
				'mb-2 flex min-h-11 items-center gap-2 px-2.5 text-meta font-semibold text-ink no-underline hover:bg-ice-soft/60 hover:text-ice-deep'
			)}
			<p class="serial px-2.5 pb-2">{t('admin.title')}</p>
			<nav class="flex flex-col" aria-label={t('nav.admin')}>
				{#each tabs as tab (tab.href)}
					{@const current = active(tab.href)}
					<a
						href={tab.href}
						class="relative flex min-h-11 items-center border-l-[3px] px-2.5 text-meta font-medium no-underline transition-colors {current
							? 'border-ice bg-ice-soft text-ice-deep'
							: 'border-transparent text-muted hover:bg-ice-soft/60 hover:text-ice-deep'}"
						aria-current={current ? 'page' : undefined}
					>
						{t(tab.labelKey)}
					</a>
				{/each}
			</nav>
		</div>
	</aside>

	<div class="min-w-0">
		<div
			class="sticky top-[calc(3.75rem+1px+env(safe-area-inset-top))] z-20 -mx-4 mb-5 border-b border-line bg-paper px-4 py-2 lg:hidden"
			bind:clientHeight={subBarHeight}
		>
			<div class="flex items-center justify-between gap-2">
				{@render backToLeague(
					t('nav.backToLeague'),
					'flex min-h-11 shrink-0 items-center gap-1 pr-2 text-meta font-semibold text-muted no-underline hover:text-ice-deep'
				)}
				<p class="serial">{t('admin.title')}</p>
			</div>
			<nav
				class="mt-1 min-w-0 overflow-x-auto"
				aria-label={t('nav.admin')}
				bind:this={mobileNav}
			>
				<ul role="list" class="flex gap-1">
					{#each tabs as tab (tab.href)}
						{@const current = active(tab.href)}
						<li class="shrink-0">
							<a
								href={tab.href}
								class="chip"
								aria-current={current ? 'page' : undefined}
							>
								{t(tab.shortLabelKey ?? tab.labelKey)}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>
		{@render children()}
	</div>
</div>
