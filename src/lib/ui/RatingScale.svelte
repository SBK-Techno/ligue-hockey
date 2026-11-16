<script lang="ts">
	import { RATING_SCALE } from '#config/rating-attributes.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		name,
		label,
		help,
		value,
		disabled = false,
		clearable = false
	}: {
		name: string;
		label: string;
		help?: string;
		value?: number | null;
		disabled?: boolean;
		clearable?: boolean;
	} = $props();

	// La valeur initiale vient du serveur; les changements suivants sont locaux.
	// svelte-ignore state_referenced_locally
	let current = $state<number | undefined>(value ?? undefined);

	const values = Array.from(
		{ length: RATING_SCALE.max - RATING_SCALE.min + 1 },
		(_, index) => RATING_SCALE.min + index
	);
</script>

<div class="grid gap-1.5 py-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
	<div class="min-w-0">
		<p class="text-sm font-semibold leading-snug">{label}</p>
		{#if help}
			<p class="mt-0.5 text-[11px] leading-snug text-muted">{help}</p>
		{/if}
	</div>
	<div class="flex items-center gap-1">
		{#each values as rating (rating)}
			<label
				class="grid h-11 w-11 cursor-pointer place-items-center border text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ice {current ===
				rating
					? 'border-ink bg-ink text-paper'
					: 'border-line-strong bg-surface text-ink hover:border-ink'}"
				title="{label} : {rating}"
			>
				<input
					class="sr-only"
					type="radio"
					{name}
					value={rating}
					bind:group={current}
					{disabled}
					aria-label="{label} : {rating}"
				/>
				{rating}
			</label>
		{/each}
		{#if clearable}
			<button
				class="grid h-11 min-w-11 place-items-center border border-line-strong bg-surface px-2 text-[11px] font-medium text-muted hover:border-ink hover:text-ink"
				type="button"
				onclick={() => (current = undefined)}
			>
				{t('rating.notObserved')}
			</button>
		{/if}
	</div>
</div>
