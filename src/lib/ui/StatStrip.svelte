<script lang="ts">
	let {
		cells
	}: {
		cells: ReadonlyArray<{ value: string | number; label: string; tone?: 'alert' }>;
	} = $props();
</script>

<div class="metric-strip-wrap">
	<dl class="metric-strip" data-cells={cells.length}>
		{#each cells as cell, index (index)}
			<div class="metric-cell">
				<dt class="min-h-8 text-caption leading-tight text-muted [overflow-wrap:anywhere]">
					{cell.label}
				</dt>
				<dd class="numeric order-first mt-1 min-w-0 whitespace-normal text-[length:var(--text-metric)] leading-tight [overflow-wrap:anywhere] {cell.tone === 'alert' ? 'text-alert' : 'text-ink'}">
					{cell.value}
				</dd>
			</div>
		{/each}
	</dl>
</div>
