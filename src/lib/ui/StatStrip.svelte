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
			<dt class="min-h-8 text-[11px] leading-tight text-muted [overflow-wrap:anywhere]">
				{cell.label}
			</dt>
			<dd class="numeric order-first mt-1 min-w-0 text-[clamp(1.15rem,5vw,1.5rem)] [overflow-wrap:anywhere] {cell.tone === 'alert' ? 'text-alert' : 'text-ink'}">
				{cell.value}
			</dd>
		</div>
	{/each}
</dl>
