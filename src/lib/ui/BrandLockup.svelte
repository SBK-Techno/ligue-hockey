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

	const markSize = $derived(
		size === 'lg' ? 'h-14 w-14 rounded-2xl' : size === 'sm' ? 'h-9 w-9 rounded-[10px]' : 'h-11 w-11 rounded-xl'
	);
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class="group flex min-w-0 items-center gap-3 no-underline"
>
	<img
		src={branding.icons.icon192}
		alt=""
		width="96"
		height="96"
		class="{markSize} shrink-0 shadow-sm ring-1 ring-ink/10"
	/>
	<span class="min-w-0">
		<span
			class="wordmark block truncate font-display font-bold leading-[1.1] {tone === 'dark'
				? 'text-paper'
				: 'text-ink'} {size === 'lg'
				? 'text-xl'
				: size === 'sm'
					? 'text-[13px]'
					: 'text-sm'}"
		>
			<span class="sm:hidden">{branding.shortName}</span>
			<span class="hidden sm:inline">{branding.name}</span>
		</span>
		{#if caption}
			<span
				class="mt-0.5 block truncate text-[10px] font-semibold leading-tight sm:text-[11px] {tone ===
				'dark'
					? 'text-paper/60'
					: 'text-muted'}"
			>
				{t('brand.presentedBy', { name: branding.organisation })}
			</span>
		{/if}
	</span>
</svelte:element>
