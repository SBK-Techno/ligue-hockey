<script lang="ts">
	import { page } from '$app/state';
	import { ACCOUNT_LIMITS } from '#config/account.ts';
	import { roleDefinition } from '#config/roles.ts';
	import { accountSurfaces, primarySurfaces } from '#lib/domain/auth/surfaces.ts';
	import type { UserActor } from '#lib/domain/auth/types.ts';
	import { formatCount, t } from '#lib/shared/i18n/index.ts';
	import BrandLockup from '#lib/ui/BrandLockup.svelte';

	let { actor, unread }: { actor: UserActor; unread: number } = $props();

	const unreadBadge = $derived(
		unread > ACCOUNT_LIMITS.unreadBadgeMax
			? `${ACCOUNT_LIMITS.unreadBadgeMax}+`
			: String(unread)
	);

	const items = $derived(primarySurfaces(actor));
	const accountItems = $derived(accountSurfaces(actor));
	const roleLabel = $derived(
		t(roleDefinition(actor.role)?.labelKey ?? 'admin.role.player')
	);

	const initials = $derived(
		actor.name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('')
	);

	let open = $state(false);
	let trigger = $state<HTMLButtonElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
	}

	function closeMenu(restoreFocus = false) {
		if (!open) return;
		open = false;
		if (restoreFocus) trigger?.focus();
	}

	function iconPath(icon: string): string {
		switch (icon) {
			case 'puck':
				return 'M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Zm2 0h12';
			case 'sub':
				return 'M4 7h16M4 12h16M4 17h10';
			case 'chat':
				return 'M4 5h16v11H9l-5 4V5Z';
			case 'user':
				return 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0';
			case 'shield':
				return 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z';
			default:
				return 'M4 11 12 4l8 7v9h-6v-6H10v6H4v-9Z';
		}
	}

	$effect(() => {
		const path = page.url.pathname;
		void path;
		// Ferme le menu à chaque changement de page, sans lire `open`
		// (sinon l'effet se relance à chaque ouverture et le referme aussitôt).
		open = false;
	});

	$effect(() => {
		if (!open) return;

		function onPointerDown(event: PointerEvent) {
			const target = event.target as Node | null;
			if (!target) return;
			if (panel?.contains(target) || trigger?.contains(target)) return;
			closeMenu();
		}

		function onKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeMenu(true);
			}
		}

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeydown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeydown);
		};
	});
</script>

<header
	class="sticky top-0 z-30 border-b border-line/80 bg-paper/92 pt-[env(safe-area-inset-top)] backdrop-blur-md"
>
	<div class="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
		<BrandLockup href="/" size="sm" />

		<nav class="ml-3 hidden items-center gap-1 md:flex" aria-label={t('nav.mainMenu')}>
			{#each items as item (item.key)}
				{@const active = isActive(item.href)}
				<a
					href={item.href}
					class="relative flex h-11 items-center whitespace-nowrap rounded-control px-3 text-sm font-semibold no-underline transition-colors {active
						? 'text-ink'
						: 'text-muted hover:bg-ink/5 hover:text-ink'}"
					aria-current={active ? 'page' : undefined}
				>
					{t(item.labelKey)}
					{#if active}
						<span
							aria-hidden="true"
							class="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-ice"
						></span>
					{/if}
				</a>
			{/each}
		</nav>

		<div class="ml-auto flex items-center gap-1">
			{#each accountItems as item (item.key)}
				<a
					href={item.href}
					class="hidden h-11 w-11 place-items-center rounded-control text-muted no-underline transition-colors hover:bg-ink/5 hover:text-ink lg:grid"
					aria-label={t(item.labelKey)}
					title={t(item.labelKey)}
				>
					<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
						<path d={iconPath(item.icon)} />
					</svg>
				</a>
			{/each}
			<a
				href="/notifications"
				class="relative grid h-11 w-11 place-items-center rounded-control text-muted no-underline transition-colors hover:bg-ink/5 hover:text-ink"
				aria-label={unread > 0
					? `${t('notifications.title')} · ${unread > ACCOUNT_LIMITS.unreadBadgeMax ? unreadBadge : formatCount(
							unread,
							'notifications.unreadCount.one',
							'notifications.unreadCount.many'
						)}`
					: t('notifications.title')}
			>
				<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
					<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
					<path d="M10 20h4" />
				</svg>
				{#if unread > 0}
					<span
						class="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-alert px-1 text-[11px] font-bold leading-4 text-on-brand"
					>
						{unreadBadge}
					</span>
				{/if}
			</a>

			<div class="relative">
				<button
					bind:this={trigger}
					type="button"
					class="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface p-1 pr-1.5 text-ink transition-colors hover:border-ink/40 md:pr-2.5"
					aria-expanded={open}
					aria-controls="menu-compte"
					aria-label={t('nav.accountMenu')}
					onclick={() => (open = !open)}
				>
					<span
						class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-display text-[11px] font-bold tracking-wide text-paper"
					>
						{initials}
					</span>
					<span class="hidden max-w-28 truncate text-sm font-semibold md:block">{actor.name}</span>
					<svg
						viewBox="0 0 24 24"
						class="hidden h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 md:block {open
							? 'rotate-180'
							: ''}"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="m6 9 6 6 6-6" />
					</svg>
				</button>

				{#if open}
					<div
						bind:this={panel}
						id="menu-compte"
						class="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-72 rounded-card border border-line bg-surface p-2 shadow-lift"
					>
						<div class="border-b border-line/80 px-2.5 pb-2.5 pt-1">
							<p class="truncate text-sm font-semibold">{actor.name}</p>
							<p class="mt-0.5 text-xs text-muted">{roleLabel}</p>
						</div>
						<nav class="mt-1 flex flex-col" aria-label={t('nav.accountMenu')}>
							<a
								class="flex min-h-11 items-center rounded-control px-2.5 text-sm font-medium no-underline hover:bg-ink/5"
								href="/profil"
								onclick={() => (open = false)}
							>
								{t('nav.profile')}
							</a>
							<a
								class="flex min-h-11 items-center justify-between gap-2 rounded-control px-2.5 text-sm font-medium no-underline hover:bg-ink/5"
								href="/notifications"
								onclick={() => (open = false)}
							>
								<span>{t('notifications.title')}</span>
								{#if unread > 0}
									<span class="badge-ice">{unreadBadge}</span>
								{/if}
							</a>
							<a
								class="flex min-h-11 items-center rounded-control px-2.5 text-sm font-medium no-underline hover:bg-ink/5"
								href="/solde"
								onclick={() => (open = false)}
							>
								{t('balance.title')}
							</a>
							{#each accountItems as item (item.key)}
								<a
									class="flex min-h-11 items-center rounded-control px-2.5 text-sm font-medium no-underline hover:bg-ink/5"
									href={item.href}
									onclick={() => (open = false)}
								>
									{t(item.labelKey)}
								</a>
							{/each}
						</nav>
						<form method="POST" action="/deconnexion" class="mt-1 border-t border-line/80 pt-1">
							<button
								class="flex min-h-11 w-full items-center rounded-control px-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-ink/5 hover:text-ink"
								type="submit"
							>
								{t('nav.logout')}
							</button>
						</form>
					</div>
				{/if}
			</div>
		</div>
	</div>
</header>

<nav
	class="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
	aria-label={t('nav.mainMenu')}
>
	<ul class="mx-auto flex max-w-lg items-stretch justify-between px-1">
		{#each items as item (item.key)}
			{@const active = isActive(item.href)}
			<li class="flex-1">
				<a
					href={item.href}
					class="relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 px-0.5 py-2 text-center text-xs font-semibold leading-tight no-underline {active
						? 'text-ink'
						: 'text-muted'}"
					aria-current={active ? 'page' : undefined}
				>
					{#if active}
						<span class="absolute inset-x-3 top-0 h-0.5 rounded-full bg-ice"></span>
					{/if}
					<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
						<path d={iconPath(item.icon)} />
					</svg>
					<span class="text-[11px] leading-tight tracking-tight">{t(item.labelKey)}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>
