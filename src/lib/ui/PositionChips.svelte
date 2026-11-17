<script lang="ts">
	import { POSITIONS } from '#config/positions.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		name = 'positions',
		selected,
		legend
	}: {
		name?: string;
		selected: readonly string[];
		legend: string;
	} = $props();
</script>

<fieldset class="min-w-0">
	<legend class="sr-only">{legend}</legend>
	<div class="chip-row">
		{#each POSITIONS as position (position.key)}
			<label
				class="chip cursor-pointer select-none has-[:checked]:border-ice has-[:checked]:bg-ice has-[:checked]:text-on-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ice"
			>
				<input
					class="sr-only"
					type="checkbox"
					{name}
					value={position.key}
					checked={selected.includes(position.key)}
				/>
				{t(position.labelKey)}
			</label>
		{/each}
	</div>
</fieldset>
