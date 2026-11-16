<script lang="ts">
	import { page } from '$app/state';
	import { branding } from '#lib/generated/branding.ts';
	import type { UserActor } from '#lib/domain/auth/types.ts';
	import { formatCount, t } from '#lib/shared/i18n/index.ts';

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
	class="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80"
>
	<div class="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
		<a href="/" class="flex min-w-0 items-center gap-2 no-underline">
			<span
				class="grid h-8 w-8 place-items-center rounded-lg bg-ink font-display text-xs font-bold text-paper"
			>
				{branding.shortName}
			</span>
			<span class="hidden truncate text-sm font-semibold text-ink sm:block">
				{branding.name}
			</span>
		</a>

		<nav class="ml-4 hidden items-center gap-1 sm:flex" aria-label={t('nav.openMenu')}>
			{#each items as item (item.href)}
				<a
					href={item.href}
					class="rounded-lg px-3 py-2 text-sm font-semibold no-underline transition-colors {isActive(
						item.href
					)
						? 'bg-ink text-paper'
						: 'text-muted hover:bg-surface hover:text-ink'}"
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					{t(item.key)}
				</a>
			{/each}
		</nav>

		<div class="ml-auto flex items-center gap-1">
			<a
				href="/notifications"
				class="relative grid h-10 w-10 place-items-center rounded-lg text-muted no-underline hover:bg-surface hover:text-ink"
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
						class="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-alert px-1 text-[10px] font-bold text-white"
					>
						{unread > 9 ? '9+' : unread}
					</span>
				{/if}
			</a>
			{#if actor.role === 'admin'}
				<a href="/admin" class="btn btn-ghost btn-sm hidden sm:inline-flex">{t('nav.admin')}</a>
			{/if}
			<form method="POST" action="/deconnexion" class="hidden sm:block">
				<button class="btn btn-ghost btn-sm" type="submit">{t('nav.logout')}</button>
			</form>
		</div>
	</div>
</header>

<nav
	class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
	aria-label={t('nav.home')}
>
	<ul class="mx-auto flex max-w-md items-stretch justify-between px-2">
		{#each items as item (item.href)}
			<li class="flex-1">
				<a
					href={item.href}
					class="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold no-underline {isActive(
						item.href
					)
						? 'text-ink'
						: 'text-muted'}"
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
						<path d={iconPath(item.icon)} />
					</svg>
					<span>{t(item.key)}</span>
				</a>
			</li>
		{/each}
		{#if actor.role === 'admin'}
			<li class="flex-1">
				<a
					href="/admin"
					class="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold no-underline {isActive(
						'/admin'
					)
						? 'text-ink'
						: 'text-muted'}"
				>
					<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
						<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" />
					</svg>
					<span>{t('nav.admin')}</span>
				</a>
			</li>
		{/if}
	</ul>
</nav>
