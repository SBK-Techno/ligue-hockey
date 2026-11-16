<script lang="ts">
	import '../routes/layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { branding } from '#lib/generated/branding.ts';
	import AppNav from '#lib/ui/AppNav.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>{branding.name}</title>
	<meta
		name="description"
		content={branding.description}
	/>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if data.actor.kind === 'anonymous'}
	<div class="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
		<header class="mb-8">
			<p class="font-display text-xs font-bold uppercase tracking-[0.24em] text-ice">
				{branding.shortName}
			</p>
			<h1 class="mt-1 text-3xl">{branding.name}</h1>
		</header>
		{@render children()}
	</div>
{:else}
	<AppNav actor={data.actor} unread={data.unread} />
	<main class="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 sm:pb-12 sm:pt-6">
		{@render children()}
	</main>
{/if}
