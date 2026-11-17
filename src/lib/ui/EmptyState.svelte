<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		help,
		action
	}: {
		title: string;
		help?: string;
		action?: Snippet;
	} = $props();
</script>

<div class="empty-state">
	<p class="text-subhead font-semibold">{title}</p>
	{#if help}
		<p class="mt-1 max-w-[var(--measure)] text-meta leading-relaxed text-muted">{help}</p>
	{/if}
	{#if action}
		<div class="mt-3">{@render action()}</div>
	{/if}
</div>
