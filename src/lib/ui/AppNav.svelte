<script lang="ts">
	import { page } from '$app/state';
	import { ACCOUNT_LIMITS } from '#config/account.ts';
	import { primarySurfaces, visibleSurfaces } from '#lib/domain/auth/surfaces.ts';
	import type { UserActor } from '#lib/domain/auth/types.ts';
	import { roleDefinition } from '#config/roles.ts';
	import { formatCount, t } from '#lib/shared/i18n/index.ts';
	import BrandLockup from '#lib/ui/BrandLockup.svelte';
	import NavIcon from '#lib/ui/NavIcon.svelte';
	import { isActiveHref } from '#lib/ui/nav.ts';

	let { actor, unread }: { actor: UserActor; unread: number } = $props();

	const path = $derived(page.url.pathname);
	const items = $derived(primarySurfaces(actor));
	const account = $derived(visibleSurfaces(actor).find((surface) => surface.key === 'account'));
	const inAdmin = $derived(path.startsWith('/admin'));

	const unreadBadge = $derived(
		unread > ACCOUNT_LIMITS.unreadBadgeMax
			? `${ACCOUNT_LIMITS.unreadBadgeMax}+`
			: String(unread)
	);

	const roleLabel = $derived(t(roleDefinition(actor.role)?.labelKey ?? 'admin.role.player'));

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

	function closeMenu(restoreFocus = false) {
		if (!open) return;
		open = false;
		if (restoreFocus) trigger?.focus();
	}

	$effect(() => {
		const current = page.url.pathname;
		void current;
		// Ferme le menu à chaque changement de page, sans lire `open`.
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
	class="sticky top-0 z-30 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur-md"
>
	<div class="mx-auto flex h-[3.75rem] w-full max-w-6xl items-center gap-3 px-4">
		<BrandLockup href="/" size="sm" />

		{#if !inAdmin}
		<nav class="ml-4 hidden items-center gap-1 lg:flex" aria-label={t('nav.mainMenu')}>
			{#each items as item (item.key)}
				{@const active = isActiveHref(path, item.href)}
				<a
					href={item.href}
					class="flex h-9 items-center whitespace-nowrap rounded-full px-3 text-meta font-medium no-underline transition-colors {active
						? 'bg-ice-soft text-ice-deep'
						: 'text-muted hover:bg-ice-soft/60 hover:text-ice-deep'}"
					aria-current={active ? 'page' : undefined}
				>
					{t(item.labelKey)}
				</a>
			{/each}
		</nav>
		{/if}

		<div class="ml-auto flex items-center gap-2">
			<a
				href="/notifications"
				class="relative grid h-11 w-11 place-items-center text-muted no-underline transition-colors hover:text-ink"
				aria-label={unread > 0
					? `${t('notifications.title')} · ${unread > ACCOUNT_LIMITS.unreadBadgeMax ? unreadBadge : formatCount(
							unread,
							'notifications.unreadCount.one',
							'notifications.unreadCount.many'
						)}`
					: t('notifications.title')}
			>
				<NavIcon icon="bell" />
				{#if unread > 0}
					<span
						class="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-stamp font-bold leading-4 text-on-brand"
					>
						{unreadBadge}
					</span>
				{/if}
			</a>

			<div class="relative">
				<button
					bind:this={trigger}
					type="button"
					class="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 text-ink transition-colors hover:border-ice"
					aria-expanded={open}
					aria-controls="menu-compte"
					aria-label="{t('nav.accountMenu')} · {actor.name}"
					onclick={() => (open = !open)}
				>
					<span
						class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ice text-caption font-semibold tracking-wide text-on-brand"
					>
						{initials}
					</span>
					<span class="hidden max-w-40 truncate text-body font-semibold xl:block">{actor.name}</span>
					<svg
						viewBox="0 0 24 24"
						class="hidden h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 xl:block {open
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
						class="absolute right-0 top-[calc(100%+0.5rem)] z-40 max-h-[70dvh] w-72 overflow-y-auto rounded-card border border-line bg-surface p-2 shadow-lift"
					>
						<div class="border-b border-line px-2.5 pb-2.5 pt-1">
							<p class="truncate text-body font-semibold">{actor.name}</p>
							<p class="mt-0.5 text-meta text-muted">{roleLabel}</p>
						</div>
						<nav class="mt-1 flex flex-col" aria-label={t('nav.accountMenu')}>
							{#if account}
								<a
									class="flex min-h-11 items-center gap-2.5 rounded-control px-2.5 text-body font-medium no-underline hover:bg-ice-soft"
									href={account.href}
									onclick={() => (open = false)}
								>
									<NavIcon icon={account.icon} class="h-4 w-4 text-ice-deep" />
									{t(account.labelKey)}
								</a>
							{/if}
							<a
								class="flex min-h-11 items-center rounded-control px-2.5 pl-10 text-body font-medium no-underline hover:bg-ice-soft"
								href="/solde"
								onclick={() => (open = false)}
							>
								{t('balance.title')}
							</a>
						</nav>
						<form method="POST" action="/deconnexion" class="mt-1 border-t border-line pt-1">
							<button
								class="flex min-h-11 w-full items-center px-2.5 text-left text-body font-medium text-muted transition-colors hover:bg-ink/5 hover:text-ink"
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

