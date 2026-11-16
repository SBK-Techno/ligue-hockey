<script lang="ts">
	import { badgeClass, type BadgeTone } from '#lib/ui/badge-tone.ts';

	let {
		href,
		date,
		title,
		meta,
		trailing,
		badge,
		badgeTone = 'neutral',
		current = false
	}: {
		href?: string;
		date?: string;
		title: string;
		meta?: string;
		trailing?: string;
		badge?: string;
		badgeTone?: BadgeTone;
		current?: boolean;
	} = $props();
</script>

{#snippet body()}
	{#if date}
		<span class="record-date">{date}</span>
	{/if}
	<span class="min-w-0 flex-1">
		<span class="block truncate text-sm font-semibold">{title}</span>
		{#if meta}
			<span class="mt-0.5 block truncate text-xs text-muted">{meta}</span>
		{/if}
	</span>
	{#if trailing}
		<span class="numeric shrink-0 text-sm">{trailing}</span>
	{/if}
	{#if badge}
		<span class="{badgeClass(badgeTone)} shrink-0">{badge}</span>
	{/if}
	{#if href}
		<svg
			viewBox="0 0 24 24"
			class="h-4 w-4 shrink-0 text-muted"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path d="m9 6 6 6-6 6" />
		</svg>
	{/if}
{/snippet}

{#if href}
	<a {href} class="record-row" aria-current={current ? 'page' : undefined}>{@render body()}</a>
{:else}
	<div class="record-row">{@render body()}</div>
{/if}
