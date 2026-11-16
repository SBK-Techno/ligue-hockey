<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/env';
	import { branding } from '#lib/generated/branding.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	let { variant = 'compact' }: { variant?: 'compact' | 'full' } = $props();

	const DISMISS_KEY = `${branding.cachePrefix}-install-dismissed`;

	type InstallEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: string }>;
	};

	let deferred = $state<InstallEvent | null>(null);
	let installed = $state(false);
	let dismissed = $state(false);
	let isIos = $state(false);

	onMount(() => {
		installed =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
		dismissed = localStorage.getItem(DISMISS_KEY) === '1';

		function onPrompt(event: Event) {
			event.preventDefault();
			deferred = event as InstallEvent;
		}

		window.addEventListener('beforeinstallprompt', onPrompt);
		return () => window.removeEventListener('beforeinstallprompt', onPrompt);
	});

	async function install() {
		if (!deferred) return;
		await deferred.prompt();
		await deferred.userChoice;
		deferred = null;
		installed = true;
	}

	function dismiss() {
		dismissed = true;
		localStorage.setItem(DISMISS_KEY, '1');
	}
</script>

{#if browser && !installed && (variant === 'full' || (!dismissed && deferred))}
	<section class="card {variant === 'compact' ? 'mt-4 border-ice/20 bg-ice-soft/50' : 'mb-4'}">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<h2 class={variant === 'compact' ? 'text-base' : ''}>{t('install.title')}</h2>
				<p class="mt-1 text-sm leading-relaxed text-muted">{t('install.body')}</p>
			</div>
			{#if deferred}
				<button class="btn-primary btn-sm" type="button" onclick={install}>
					{t('install.action')}
				</button>
			{/if}
		</div>
		{#if variant === 'full'}
			<ul class="mt-3 space-y-1.5 text-sm text-muted">
				<li>{t('install.ios')}</li>
				<li>{t('install.android')}</li>
				<li>{t('install.desktop')}</li>
			</ul>
		{:else if isIos}
			<p class="mt-2 text-xs text-muted">{t('install.ios')}</p>
		{/if}
		{#if variant === 'compact' && !deferred}
			<button class="btn-ghost btn-sm mt-2" type="button" onclick={dismiss}>
				{t('install.later')}
			</button>
		{/if}
	</section>
{/if}
