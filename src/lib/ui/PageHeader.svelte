<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		eyebrow,
		meta,
		back,
		actions
	}: {
		title: string;
		eyebrow?: string;
		meta?: string;
		back?: { href: string; label: string };
		actions?: Snippet;
	} = $props();
</script>

<header class="mb-6">
	{#if back}
		<a
			class="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted no-underline hover:text-ink"
			href={back.href}
		>
			<svg
				viewBox="0 0 24 24"
				class="h-4 w-4"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="m15 6-6 6 6 6" />
			</svg>
			{back.label}
		</a>
	{/if}

	<div class="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
		<div class="min-w-0">
			{#if eyebrow}
				<p class="micro-label">{eyebrow}</p>
			{/if}
			<h1 class="first-letter:uppercase {eyebrow ? 'mt-1' : ''}">{title}</h1>
			{#if meta}
				<p class="mt-1.5 text-sm text-muted">{meta}</p>
			{/if}
		</div>

		{#if actions}
			<div class="flex flex-wrap items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>
</header>
