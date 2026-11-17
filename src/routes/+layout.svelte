<script lang="ts">
	import '../routes/layout.css';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { branding } from '#lib/generated/branding.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import anybodyLatin from '@fontsource-variable/anybody/files/anybody-latin-wdth-normal.woff2?url';
	import splineLatin from '@fontsource-variable/spline-sans-mono/files/spline-sans-mono-latin-wght-normal.woff2?url';
	import AppNav from '#lib/ui/AppNav.svelte';
	import AppNavBottom from '#lib/ui/AppNavBottom.svelte';
	import BrandLockup from '#lib/ui/BrandLockup.svelte';
	import PlayerPeek from '#lib/ui/PlayerPeek.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const titles: Array<[string, Parameters<typeof t>[0]]> = [
		['/admin/joueurs', 'admin.players'],
		['/admin/matchs', 'admin.games'],
		['/admin/regles', 'admin.rules'],
		['/admin/soldes', 'admin.balances'],
		['/admin/parametres', 'admin.settings'],
		['/admin/lieux', 'admin.locations'],
		['/admin/evaluations', 'admin.evaluationsSeason'],
		['/admin', 'admin.title'],
		['/matchs', 'games.title'],
		['/remplacants', 'subs.title'],
		['/discussion', 'nav.chat'],
		['/notifications', 'notifications.title'],
		['/solde', 'balance.title'],
		['/profil', 'nav.profile'],
		['/connexion', 'auth.title'],
		['/mot-de-passe-oublie', 'auth.reset.title'],
		['/reinitialiser-mot-de-passe', 'invite.title']
	];

	const pageTitle = $derived.by(() => {
		const path = page.url.pathname;
		if (path === '/') return branding.name;
		const match = titles.find(
			([prefix]) => path === prefix || path.startsWith(`${prefix}/`)
		);
		return match ? `${t(match[1])} · ${branding.shortName}` : branding.name;
	});

	const showBottomBar = $derived(!page.url.pathname.startsWith('/admin'));
	const socialImage = $derived(new URL(branding.socialImage, page.url.origin).toString());
	const openGraphLocale = $derived(branding.locale.replace('-', '_'));
	const crawlDirective = $derived(branding.indexable ? 'index,follow' : 'noindex,nofollow');

	afterNavigate(({ from, to }) => {
		if (!from || !to || from.url.pathname === to.url.pathname) return;
		document.getElementById('contenu')?.focus({ preventScroll: true });
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={branding.description} />
	<meta name="theme-color" content={branding.themeColor} />
	<meta name="robots" content={crawlDirective} />
	<meta name="apple-mobile-web-app-title" content={branding.shortName} />
	<link rel="icon" href={branding.icons.favicon} />
	<link rel="apple-touch-icon" href={branding.icons.appleTouch} />
	<link rel="manifest" href={branding.manifestPath} />
	<link rel="preload" href={anybodyLatin} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={splineLatin} as="font" type="font/woff2" crossorigin="anonymous" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={branding.name} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={branding.description} />
	<meta property="og:image" content={socialImage} />
	<meta property="og:locale" content={openGraphLocale} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={branding.description} />
	<meta name="twitter:image" content={socialImage} />
</svelte:head>

{#if data.actor.kind === 'anonymous'}
	<div class="auth-shell">
		<div class="auth-hero">
			<img src={branding.authImage} alt="" fetchpriority="high" decoding="async" />
			<div class="auth-scrim" aria-hidden="true"></div>
			<header class="auth-header">
				<BrandLockup size="md" tone="dark" />
			</header>
		</div>

		<div class="auth-body">
			<main id="contenu" tabindex="-1" class="auth-main">
				<div class="auth-panel page-enter">
					{@render children()}
				</div>
			</main>

			<p class="auth-caption">
				<span class="h-px w-10 bg-line-strong" aria-hidden="true"></span>
				<span class="micro-label text-muted">{t('auth.afterGame')}</span>
			</p>
		</div>
	</div>
{:else}
	<div class="app-shell" style="--page-texture: url({branding.textures.paper})">
		<div class="page-ground" aria-hidden="true"></div>
		<a class="skip-link" href="#contenu">{t('nav.skip')}</a>
		<AppNav actor={data.actor} unread={data.unread} avatarId={data.avatarId} />
		<main
			id="contenu"
			tabindex="-1"
			class="mx-auto w-full max-w-6xl xl:max-w-7xl scroll-mt-[var(--anchor-offset)] px-4 pb-8 pt-6 sm:pt-8 lg:pb-12"
		>
			{#key page.url.pathname}
				<div class="page-enter">{@render children()}</div>
			{/key}
			<div aria-live="polite" class="sr-only">{pageTitle}</div>
		</main>
		<AppNavBottom actor={data.actor} />
		<PlayerPeek />
		<footer
			class="mx-auto w-full max-w-6xl xl:max-w-7xl px-4 pt-2 lg:pb-8 {showBottomBar
				? 'pb-[calc(var(--bottom-bar-offset)+0.5rem)]'
				: 'pb-2'}"
		>
			<div
				class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-caption font-medium text-muted"
			>
				<p>{branding.name}</p>
				<p>{t('brand.presentedBy', { name: branding.organisation })}</p>
			</div>
		</footer>
	</div>
{/if}
