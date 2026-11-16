<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		href,
		linkLabel,
		flush = false,
		children
	}: {
		title: string;
		href?: string;
		linkLabel?: string;
		/** Une liste ou un tableau porte ses propres rangées pleine largeur. */
		flush?: boolean;
		children: Snippet;
	} = $props();
</script>

<section class="sheet overflow-hidden">
	<header class="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
		<h2>{title}</h2>
		{#if href && linkLabel}
			<a class="link -my-2 inline-flex min-h-11 items-center text-body" {href}>{linkLabel}</a>
		{/if}
	</header>
	{#if flush}
		{@render children()}
	{:else}
		<div class="section-body">{@render children()}</div>
	{/if}
</section>
