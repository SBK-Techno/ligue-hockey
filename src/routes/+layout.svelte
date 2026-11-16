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
	<div class="lg:grid lg:min-h-dvh lg:grid-cols-[1.08fr_0.92fr]">
		<aside
			class="relative flex min-h-[18rem] flex-col overflow-hidden bg-ink px-5 pb-6 pt-5 text-paper sm:min-h-[22rem] sm:px-9 sm:pb-11 sm:pt-9 lg:min-h-dvh lg:p-12"
		>
			<img
				src={branding.authImage}
				alt=""
				class="absolute inset-0 h-full w-full object-cover"
				fetchpriority="high"
				decoding="async"
			/>
			<div
				class="absolute inset-0 bg-gradient-to-b from-ink/90 via-ink/20 to-ink/35"
				aria-hidden="true"
			></div>

			<div class="relative z-10">
				<BrandLockup size="md" tone="dark" />
			</div>
		</aside>

		<main
			id="contenu"
			tabindex="-1"
			class="flex scroll-mt-[var(--anchor-offset)] items-start justify-center px-4 py-8 sm:px-8 sm:py-12 lg:min-h-dvh lg:items-center"
		>
			<div class="w-full max-w-sm">
				{@render children()}
			</div>
		</main>
	</div>
{:else}
	<a class="skip-link" href="#contenu">{t('nav.skip')}</a>
	<AppNav actor={data.actor} unread={data.unread} />
	<main
		id="contenu"
		tabindex="-1"
		class="mx-auto w-full max-w-6xl scroll-mt-[var(--anchor-offset)] px-4 pb-8 pt-6 sm:pt-8 lg:pb-12"
	>
		{@render children()}
		<div aria-live="polite" class="sr-only">{pageTitle}</div>
	</main>
	<AppNavBottom actor={data.actor} />
	<footer class="mx-auto w-full max-w-6xl px-4 pb-[calc(var(--bottom-bar-offset)+0.5rem)] pt-2 lg:pb-8">
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-5 text-[11px] font-medium text-muted"
		>
			<p>{branding.name}</p>
			<p>{t('brand.presentedBy', { name: branding.organisation })}</p>
		</div>
	</footer>
{/if}
