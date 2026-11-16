<script lang="ts">
	import { branding } from '#lib/generated/branding.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		href,
		size = 'md',
		caption = true,
		tone = 'light'
	}: {
		href?: string;
		size?: 'sm' | 'md' | 'lg';
		caption?: boolean;
		tone?: 'light' | 'dark';
	} = $props();

	const barHeight = $derived(
		size === 'lg' ? 'h-12' : size === 'sm' ? 'h-8' : 'h-10'
	);
	const nameSize = $derived(
		size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-[15px]' : 'text-base'
	);
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class="group flex min-h-11 min-w-0 items-center gap-3 no-underline"
>
	<span aria-hidden="true" class="{barHeight} w-[3px] shrink-0 bg-accent"></span>
	<span class="min-w-0">
		<span
			class="wordmark block truncate font-display leading-[1.05] {tone === 'dark'
				? 'text-paper'
				: 'text-ink'} {nameSize}"
		>
			<span class="sm:hidden">{branding.shortName}</span>
			<span class="hidden sm:inline">{branding.name}</span>
		</span>
		{#if caption}
			<span
				class="mt-0.5 block truncate font-mono text-[10px] font-medium uppercase leading-tight tracking-[0.08em] {tone ===
				'dark'
					? 'text-paper/60'
					: 'text-muted'}"
			>
				{t('brand.presentedBy', { name: branding.organisation })}
			</span>
		{/if}
	</span>
</svelte:element>
