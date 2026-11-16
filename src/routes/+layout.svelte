<script lang="ts">
	import '../routes/layout.css';
	import { page } from '$app/state';
	import { branding } from '#lib/generated/branding.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import AppNav from '#lib/ui/AppNav.svelte';
	import BrandLockup from '#lib/ui/BrandLockup.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const titles: Array<[string, Parameters<typeof t>[0]]> = [
		['/admin/joueurs', 'admin.players'],
		['/admin/matchs', 'admin.games'],
		['/admin/regles', 'admin.rules'],
		['/admin/soldes', 'admin.balances'],
		['/admin/parametres', 'admin.settings'],
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
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={branding.description} />
	<meta name="theme-color" content={branding.themeColor} />
	<meta name="apple-mobile-web-app-title" content={branding.shortName} />
	<link rel="icon" href={branding.icons.favicon} />
	<link rel="apple-touch-icon" href={branding.icons.appleTouch} />
	<link rel="manifest" href={branding.manifestPath} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={branding.name} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={branding.description} />
	<meta property="og:image" content={socialImage} />
	<meta property="og:locale" content="fr_CA" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={branding.description} />
	<meta name="twitter:image" content={socialImage} />
</svelte:head>

{#if data.actor.kind === 'anonymous'}
	<div class="lg:grid lg:min-h-dvh lg:grid-cols-[1.08fr_0.92fr]">
		<aside
			class="relative flex flex-col justify-between overflow-hidden bg-ink px-5 pb-9 pt-7 text-paper sm:px-9 sm:pb-11 sm:pt-9 lg:min-h-dvh lg:p-12"
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 600 600"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				class="pointer-events-none absolute -right-28 -top-24 h-[420px] w-[420px] text-paper/[0.08] sm:h-[520px] sm:w-[520px] lg:-right-32 lg:top-1/2 lg:h-[680px] lg:w-[680px] lg:-translate-y-1/2"
			>
				<circle cx="300" cy="300" r="232" />
				<circle cx="300" cy="300" r="92" />
				<path d="M0 300h600M300 0v600" />
				<circle cx="300" cy="300" r="7" fill="currentColor" stroke="none" />
				<path d="M68 208h56v184H68M532 208h-56v184h56" />
			</svg>

			<div class="relative">
				<BrandLockup size="md" tone="dark" />
			</div>

			<div class="relative mt-8 max-w-md lg:mt-0">
				<h1 class="text-paper">{t('auth.welcome')}</h1>
				<p class="mt-4 text-sm leading-relaxed text-paper/70 sm:text-base">
					{branding.description}
				</p>
			</div>
		</aside>

		<main
			id="contenu"
			class="flex items-start justify-center px-4 py-8 sm:px-8 sm:py-12 lg:min-h-dvh lg:items-center"
		>
			<div class="w-full max-w-sm">
				{@render children()}
			</div>
		</main>
	</div>
{:else}
	<a class="skip-link" href="#contenu">{t('nav.skip')}</a>
	<AppNav actor={data.actor} unread={data.unread} />
	<main id="contenu" class="mx-auto w-full max-w-6xl px-4 pb-8 pt-5 sm:pt-8 lg:pb-12">
		{@render children()}
	</main>
	<footer class="mx-auto w-full max-w-6xl px-4 pb-[calc(var(--bottom-bar-offset)+0.5rem)] pt-2 lg:pb-8">
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-5 text-[11px] font-medium text-muted"
		>
			<p>{branding.name}</p>
			<p>{t('brand.presentedBy', { name: branding.organisation })}</p>
		</div>
	</footer>
{/if}
