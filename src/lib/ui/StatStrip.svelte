<script lang="ts">
	let {
		cells
	}: {
		cells: ReadonlyArray<{ value: string | number; label: string; tone?: 'alert' }>;
	} = $props();
</script>

<dl class="metric-strip">
	{#each cells as cell (cell.label)}
		<div class="metric-cell">
			<dd class="numeric text-[1.5rem] {cell.tone === 'alert' ? 'text-alert' : 'text-ink'}">
				{cell.value}
			</dd>
			<dt class="mt-1 min-h-8 text-[11px] leading-tight text-muted">{cell.label}</dt>
		</div>
	{/each}
</dl>
