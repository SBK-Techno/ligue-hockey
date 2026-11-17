<script lang="ts">
	import { formatCount } from '#lib/shared/i18n/index.ts';

	let { count, onshow }: { count: number; onshow: () => void } = $props();

	const label = $derived(
		count > 0 ? formatCount(count, 'chat.newMessages.one', 'chat.newMessages.many') : ''
	);
</script>

<div
	class="fixed inset-x-4 bottom-[calc(var(--bottom-bar-offset)+var(--bottom-bar-height))] z-30 mx-auto flex max-w-md justify-center lg:bottom-[calc(var(--footer-offset)+var(--surface-bottom-inset,0px)+1rem)]"
>
	{#if count > 0}
		<button class="btn-primary btn-sm" type="button" onclick={onshow}>
			{label}
		</button>
	{/if}
</div>
<p class="sr-only" role="status">{label}</p>
