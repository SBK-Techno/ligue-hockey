<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		href,
		linkLabel,
		flush = false,
		clip = true,
		actions,
		class: className = '',
		children
	}: {
		title: string;
		href?: string;
		linkLabel?: string;
		/** Une liste ou un tableau porte ses propres rangées pleine largeur. */
		flush?: boolean;
		/** Un menu absolu doit sortir de la feuille : la carte ne le coupe pas. */
		clip?: boolean;
		actions?: Snippet;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<section class="sheet {clip ? 'overflow-hidden' : ''} {className}">
	<header class="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
		<h2>{title}</h2>
		{#if actions}
			<div class="flex flex-wrap items-center gap-2">
				{@render actions()}
			</div>
		{:else if href && linkLabel}
			<a class="link -my-2 inline-flex min-h-11 items-center text-body" {href}>{linkLabel}</a>
		{/if}
	</header>
	{#if flush}
		{@render children()}
	{:else}
		<div class="section-body">{@render children()}</div>
	{/if}
</section>
