<script lang="ts">
	let {
		items,
		active,
		label,
		onselect
	}: {
		items: ReadonlyArray<{ key: string; label: string; count?: number }>;
		active: string;
		label: string;
		onselect: (key: string) => void;
	} = $props();
</script>

<div class="chip-row" role="group" aria-label={label}>
	{#each items as item (item.key)}
		<button
			type="button"
			class="chip"
			aria-pressed={active === item.key}
			onclick={() => onselect(item.key)}
		>
			{item.label}
			{#if item.count !== undefined}
				<span class="numeric text-caption">{item.count}</span>
			{/if}
		</button>
	{/each}
</div>
