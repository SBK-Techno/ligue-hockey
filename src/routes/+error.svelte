<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/shared/i18n/index.ts';
	import BrandLockup from '#lib/ui/BrandLockup.svelte';

	const title = $derived(
		page.status === 404
			? t('error.title.notFound')
			: page.status === 403
				? t('error.title.forbidden')
				: t('error.title.generic')
	);
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div class="flex min-h-[60dvh] flex-col items-center justify-center px-4 py-12 text-center">
	<BrandLockup href="/" size="md" caption={false} />
	<p class="numeric mt-8 text-6xl text-accent">{page.status}</p>
	<h1 class="mt-4 text-3xl">{title}</h1>
	<p class="mt-3 max-w-sm text-body leading-relaxed text-muted">{t('error.help')}</p>
	<div class="mt-7 flex flex-wrap items-center justify-center gap-3">
		<a class="btn-primary" href="/">{t('error.home')}</a>
		<a class="btn-secondary" href="/matchs">{t('games.title')}</a>
	</div>
</div>
