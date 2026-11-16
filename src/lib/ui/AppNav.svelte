<script lang="ts">
	import { page } from '$app/state';
	import type { UserActor } from '#lib/domain/auth/types.ts';
	import { formatCount, t } from '#lib/shared/i18n/index.ts';
	import BrandLockup from '#lib/ui/BrandLockup.svelte';

	let { actor, unread }: { actor: UserActor; unread: number } = $props();

	const items = [
		{ href: '/', key: 'nav.home' as const, icon: 'home' },
		{ href: '/matchs', key: 'nav.games' as const, icon: 'puck' },
		{ href: '/remplacants', key: 'subs.title' as const, icon: 'sub' },
		{ href: '/discussion', key: 'nav.chat' as const, icon: 'chat' },
		{ href: '/profil', key: 'nav.profile' as const, icon: 'user' }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
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
			default:
				return 'M4 11 12 4l8 7v9h-6v-6H10v6H4v-9Z';
		}
	}
</script>

<header
	class="sticky top-0 z-30 border-b border-line/80 bg-paper/92 pt-[env(safe-area-inset-top)] backdrop-blur-md"
>
	<div class="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
		<BrandLockup href="/" size="sm" />

		<nav class="ml-3 hidden items-center gap-1 sm:flex" aria-label={t('nav.mainMenu')}>
			{#each items as item (item.href)}
				<a
					href={item.href}
					class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold no-underline transition-colors {isActive(
						item.href
					)
						? 'bg-ink text-paper'
						: 'text-muted hover:bg-ink/5 hover:text-ink'}"
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					{t(item.key)}
				</a>
			{/each}
		</nav>

		<div class="ml-auto flex items-center gap-1">
			<a
				href="/notifications"
				class="relative grid h-10 w-10 place-items-center rounded-lg text-muted no-underline transition-colors hover:bg-ink/5 hover:text-ink"
				aria-label={unread > 0
					? `${t('notifications.title')} · ${unread > 9 ? '9+' : formatCount(
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
						class="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-alert px-1 text-[10px] font-bold leading-4 text-white"
					>
						{unread > 9 ? '9+' : unread}
					</span>
				{/if}
			</a>
			{#if actor.role === 'admin'}
				<a href="/admin" class="btn btn-ghost btn-sm hidden whitespace-nowrap sm:inline-flex">{t('nav.admin')}</a>
			{/if}
			<form method="POST" action="/deconnexion" class="hidden sm:block">
				<button class="btn btn-ghost btn-sm whitespace-nowrap" type="submit">{t('nav.logout')}</button>
			</form>
		</div>
	</div>
</header>

<nav
	class="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
	aria-label={t('nav.mainMenu')}
>
	<ul class="mx-auto flex max-w-lg items-stretch justify-between px-1">
		{#each items as item (item.href)}
			{@const active = isActive(item.href)}
			<li class="flex-1">
				<a
					href={item.href}
					class="relative flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold no-underline {active
						? 'text-ice'
						: 'text-muted'}"
					aria-current={active ? 'page' : undefined}
				>
					{#if active}
						<span class="absolute inset-x-4 top-0 h-0.5 rounded-full bg-ice"></span>
					{/if}
					<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
						<path d={iconPath(item.icon)} />
					</svg>
					<span>{t(item.key)}</span>
				</a>
			</li>
		{/each}
		{#if actor.role === 'admin'}
			{@const active = isActive('/admin')}
			<li class="flex-1">
				<a
					href="/admin"
					class="relative flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold no-underline {active
						? 'text-ice'
						: 'text-muted'}"
					aria-current={active ? 'page' : undefined}
				>
					{#if active}
						<span class="absolute inset-x-4 top-0 h-0.5 rounded-full bg-ice"></span>
					{/if}
					<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
						<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" />
					</svg>
					<span>{t('nav.admin')}</span>
				</a>
			</li>
		{/if}
	</ul>
</nav>
