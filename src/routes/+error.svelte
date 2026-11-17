<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/shared/i18n/index.ts';

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

<div
	class="mx-auto flex min-h-[60dvh] w-full max-w-xl flex-col justify-center py-12 text-center"
>
	<p class="stamp self-center border-accent/40 bg-accent-soft/60 text-accent">{page.status}</p>
	<h1 class="mt-4 text-display">{title}</h1>
	<p class="mx-auto mt-3 max-w-[var(--measure)] text-body leading-relaxed text-muted">
		{t('error.help')}
	</p>
	<a class="btn-primary mt-7 self-center" href="/">{t('error.home')}</a>
</div>
