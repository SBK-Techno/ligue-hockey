<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div
	class="sticky bottom-0 z-20 -mx-4 border-t border-line bg-paper px-4 py-2 sm:mx-0 sm:rounded-control sm:border"
>
	{@render children()}
</div>
