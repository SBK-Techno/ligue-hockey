<script lang="ts">
	import { RATING_SCALE } from '#config/rating-attributes.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		name,
		label,
		help,
		value = $bindable<number | undefined>(undefined),
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

	const id = $props.id();
	const helpId = `${id}-help`;

	const values = Array.from(
		{ length: RATING_SCALE.max - RATING_SCALE.min + 1 },
		(_, index) => RATING_SCALE.min + index
	);
</script>

<fieldset
	class="grid gap-1.5 py-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
	{disabled}
	aria-describedby={help ? helpId : undefined}
>
	<legend class="sr-only">{label}</legend>
	<div class="min-w-0">
		<p class="text-sm font-semibold leading-snug" aria-hidden="true">{label}</p>
		{#if help}
			<p id={helpId} class="mt-0.5 text-[11px] leading-snug text-muted">{help}</p>
		{/if}
	</div>
	<div class="flex items-center gap-1 {disabled ? 'opacity-60' : ''}">
		{#each values as rating (rating)}
			<label
				class="relative grid h-11 w-11 cursor-pointer place-items-center border text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ice {disabled
					? value === rating
						? 'cursor-not-allowed border-line-strong bg-paper-deep text-ink'
						: 'cursor-not-allowed border-line bg-surface text-muted'
					: value === rating
						? 'border-ink bg-ink text-paper'
						: 'border-line-strong bg-surface text-ink hover:border-ink'}"
				title="{label} : {rating}"
			>
				<input
					class="sr-only"
					type="radio"
					{name}
					value={rating}
					bind:group={value}
					{disabled}
					aria-label="{label} : {rating}"
				/>
				{rating}
				{#if value === rating}
					<span class="absolute right-1 top-1 h-1.5 w-1.5 bg-current" aria-hidden="true"></span>
				{/if}
			</label>
		{/each}
		{#if clearable}
			<button
				class="grid h-11 min-w-11 place-items-center border border-line-strong bg-surface px-2 text-[11px] font-medium text-muted hover:border-ink hover:text-ink"
				type="button"
				{disabled}
				aria-label="{label} : {t('rating.notObserved')}"
				onclick={() => (value = undefined)}
			>
				{t('rating.notObserved')}
			</button>
		{/if}
	</div>
</fieldset>
