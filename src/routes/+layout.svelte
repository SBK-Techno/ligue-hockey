<script lang="ts">
	import '../routes/layout.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { branding } from '#lib/generated/branding.ts';
	import { materialVars } from '#lib/ui/materials.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import anybodyLatin from '@fontsource-variable/anybody/files/anybody-latin-wdth-normal.woff2?url';
	import splineLatin from '@fontsource-variable/spline-sans-mono/files/spline-sans-mono-latin-wght-normal.woff2?url';
	import AppNav from '#lib/ui/AppNav.svelte';
	import AppNavBottom from '#lib/ui/AppNavBottom.svelte';
	import BrandLockup from '#lib/ui/BrandLockup.svelte';
	import { resolvePageTitle } from '#lib/ui/page-title.ts';
	import type { ConfirmRequest } from '#lib/ui/confirm.svelte.ts';
	import { CONFIRM_REQUEST_EVENT, PLAYER_PEEK_EVENT } from '#lib/ui/events.ts';
	import { reloadOnServiceWorkerUpdate } from '#lib/ui/service-worker-update.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const pageTitle = $derived(
		resolvePageTitle({
			pathname: page.url.pathname,
			brandName: branding.name,
			shortName: branding.shortName,
			detail: page.data.detailTitle
		})
	);

	const showBottomBar = $derived(!page.url.pathname.startsWith('/admin'));
	const socialImage = $derived(new URL(branding.socialImage, page.url.origin).toString());
	const openGraphLocale = $derived(branding.locale.replace('-', '_'));
	const crawlDirective = $derived(branding.indexable ? 'index,follow' : 'noindex,nofollow');

	let peekHost = $state(false);
	let confirmRequest = $state<ConfirmRequest | null>(null);

	function settleConfirm(confirmed: boolean) {
		const current = confirmRequest;
		confirmRequest = null;
		current?.settle(confirmed);
	}

	onMount(() => {
		const stopServiceWorkerReload = reloadOnServiceWorkerUpdate();
		const showPeek = () => {
			peekHost = true;
		};
		const showConfirm = (event: Event) => {
			const detail = (event as CustomEvent<ConfirmRequest>).detail;
			if (!detail) return;
			// Une nouvelle demande remplace une demande abandonnée.
			confirmRequest?.settle(false);
			confirmRequest = detail;
		};
		window.addEventListener(PLAYER_PEEK_EVENT, showPeek);
		window.addEventListener(CONFIRM_REQUEST_EVENT, showConfirm);
		return () => {
			stopServiceWorkerReload();
			window.removeEventListener(PLAYER_PEEK_EVENT, showPeek);
			window.removeEventListener(CONFIRM_REQUEST_EVENT, showConfirm);
		};
	});

	// Les déclencheurs du peek s'installent après la peinture initiale; aucune
	// page ne paie la carte avant d'avoir interagi avec un joueur. La portée
	// suit la capacité calculée par le serveur et vide le cache si elle change.
	$effect(() => {
		/* Aucune fiche joueur ne peut s'ouvrir sans session : la page de
		   connexion ne télécharge donc pas ce morceau après la peinture. */
		if (data.actor.kind === 'anonymous') return;
		const scope = data.peekScope;
		let active = true;
		let dispose: (() => void) | undefined;
		void import('#lib/ui/player-peek.svelte.ts').then(
			({ installPlayerPeekTriggers, setPlayerPeekScope }) => {
				if (!active) return;
				setPlayerPeekScope(scope);
				dispose = installPlayerPeekTriggers();
			}
		);
		return () => {
			active = false;
			dispose?.();
		};
	});

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
	<meta property="og:image:alt" content={branding.name} />
	<meta property="og:locale" content={openGraphLocale} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={branding.description} />
	<meta name="twitter:image" content={socialImage} />
	<meta name="twitter:image:alt" content={branding.name} />
</svelte:head>

{#if data.actor.kind === 'anonymous'}
	<div class="auth-shell">
		<div class="auth-hero">
			<img
				src={branding.auth.src}
				srcset={branding.auth.srcset}
				sizes="(min-width: 900px) 60vw, 100vw"
				width={branding.auth.width}
				height={branding.auth.height}
				alt=""
				fetchpriority="high"
				decoding="async"
			/>
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

			<footer class="auth-caption">
				<span class="h-px w-10 bg-line-strong" aria-hidden="true"></span>
				<span class="micro-label text-muted">{t('auth.afterGame')}</span>
			</footer>
		</div>
	</div>
{:else}
	<div class="app-shell" style="{materialVars('paper')}; {materialVars('ice')}">
		<div class="page-ground" aria-hidden="true"></div>
		<a class="skip-link" href="#contenu">{t('nav.skip')}</a>
		<AppNav
			name={data.actor.name}
			userId={data.actor.userId}
			items={data.nav.primary}
			account={data.nav.account}
			roleLabelKey={data.nav.roleLabelKey}
			unread={data.unread}
			unreadCap={data.nav.unreadCap}
			avatarId={data.avatarId}
		/>
		<main
			id="contenu"
			tabindex="-1"
			class="mx-auto w-full max-w-6xl xl:max-w-7xl px-4 pb-8 pt-6 sm:pt-8 lg:pb-12"
		>
			{#key page.url.pathname}
				<div class="page-enter">{@render children()}</div>
			{/key}
			<div aria-live="polite" class="sr-only">{pageTitle}</div>
		</main>
		<AppNavBottom items={data.nav.mobile} />
		{#if peekHost}
			{#await import('#lib/ui/PlayerPeek.svelte') then { default: PlayerPeek }}
				<PlayerPeek />
			{/await}
		{/if}
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

{#if confirmRequest}
	{#await import('#lib/ui/ConfirmDialog.svelte') then { default: ConfirmDialog }}
		<ConfirmDialog request={confirmRequest} onSettle={settleConfirm} />
	{/await}
{/if}
