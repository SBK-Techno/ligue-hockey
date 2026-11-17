<script lang="ts">
	import { isLegendId, legendOptionsForPosition } from '#config/legends.ts';
	import type { Position } from '#config/positions.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import Avatar from './Avatar.svelte';

	let {
		name = 'avatarId',
		selected,
		taken = [],
		help = t('profile.avatarHelp'),
		position = null,
		legendsTitle = t('profile.legendsTitle'),
		legendsHelp = t('profile.legendsHelp')
	}: {
		name?: string;
		selected: string;
		taken?: readonly string[];
		help?: string;
		position?: Position | null;
		legendsTitle?: string;
		legendsHelp?: string;
	} = $props();

	const id = $props.id();
	const helpId = `${id}-help`;
	const legendHelpId = `${id}-legends`;
	const legendTitleId = `${id}-legends-title`;
	const takenSet = $derived(new Set(taken));
	// Snapshot the saved identity for the editable radio group; a failed submit
	// keeps the player's choice visible. A legacy league face stays available
	// as one card, even after a legend is picked, but is never a catalogue.
	// svelte-ignore state_referenced_locally
	const initial = selected;
	const initialIsLeagueFace = !isLegendId(initial);
	// svelte-ignore state_referenced_locally
	let current = $state(selected);

	/**
	 * A saved legend stays visible even when the chosen position no longer
	 * matches, so the radio group always has a checked card to submit.
	 */
	const legendOptions = $derived(
		position ? legendOptionsForPosition(position, current) : []
	);

	function isMismatch(legendPosition: Position): boolean {
		return position !== null && legendPosition !== position;
	}
</script>

<fieldset class="min-w-0" aria-describedby={helpId}>
	<legend class="label">{t('profile.avatar')}</legend>
	<p id={helpId} class="hint">{help}</p>

	<div
		class="mt-4"
		role="radiogroup"
		aria-labelledby={legendTitleId}
		aria-describedby={legendHelpId}
	>
		<h3 id={legendTitleId} class="text-subhead font-semibold">{legendsTitle}</h3>
		{#if !position}
			<p id={legendHelpId} class="mt-2 text-meta text-muted">
				{t('profile.legendsNeedPosition')}
			</p>
		{:else}
			<p id={legendHelpId} class="mt-2 text-meta text-muted">{legendsHelp}</p>
		{/if}

		<div class="mt-3 grid gap-2">
			{#if initialIsLeagueFace}
				<label
					class="relative flex min-w-0 cursor-pointer items-center gap-3 rounded-control border border-line-strong bg-surface p-2 transition-colors hover:border-ice has-[:checked]:border-ice has-[:checked]:bg-ice-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ice"
				>
					<input
						class="sr-only"
						type="radio"
						{name}
						value={initial}
						bind:group={current}
						aria-label="{t('profile.avatarLeague')} · {t('profile.identityCurrent')}"
					/>
					<Avatar
						player={{
							fullName: t('profile.avatarLeague'),
							userId: initial,
							avatarId: initial
						}}
						size={48}
						peek={false}
					/>
					<span class="min-w-0 flex-1">
						<span class="block text-body font-semibold leading-snug">
							{t('profile.avatarLeague')}
						</span>
						<span class="mt-0.5 block text-caption text-muted">
							{t('profile.identityCurrent')}
						</span>
					</span>
					{#if current === initial}
						<span class="shrink-0 text-ice" aria-hidden="true">
							<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="3">
								<path d="m5 12 4 4 10-10" />
							</svg>
						</span>
					{/if}
				</label>
			{/if}

			{#each legendOptions as legend (legend.id)}
				{@const isTaken = takenSet.has(legend.id)}
				{@const isSelected = current === legend.id}
				{@const label = isTaken
					? t('profile.legendOptionTaken', { name: legend.name })
					: t('profile.legendOption', {
							name: legend.name,
							number: legend.number,
							era: legend.era
						})}
				<label
					class="relative flex min-w-0 items-center gap-3 rounded-control border p-2 transition-colors has-[:checked]:border-ice has-[:checked]:bg-ice-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ice {isTaken
						? 'cursor-not-allowed border-line bg-paper-deep/40 opacity-50 grayscale'
						: 'cursor-pointer border-line-strong bg-surface hover:border-ice'}"
					data-taken={isTaken}
				>
					<input
						class="sr-only"
						type="radio"
						{name}
						value={legend.id}
						bind:group={current}
						disabled={isTaken}
						aria-label={label}
						aria-describedby={isMismatch(legend.position)
							? `${id}-${legend.id}-mismatch`
							: undefined}
					/>
					<Avatar
						player={{ fullName: legend.name, userId: legend.id, avatarId: legend.id }}
						size={48}
						peek={false}
					/>
					<span class="min-w-0 flex-1">
						<span class="block break-words text-body font-semibold leading-snug">
							{legend.name}
						</span>
						<span class="mt-0.5 block font-mono text-caption text-muted">
							#{legend.number} · {legend.era}
						</span>
						{#if isMismatch(legend.position)}
							<span
								id="{id}-{legend.id}-mismatch"
								class="mt-0.5 block text-stamp text-muted"
							>
								{t('profile.legendMismatch')}
							</span>
						{/if}
					</span>
					{#if isTaken}
						<span class="shrink-0 text-muted" aria-hidden="true">
							<svg
								viewBox="0 0 24 24"
								class="h-4 w-4"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<rect x="5" y="11" width="14" height="10" rx="2" />
								<path d="M8 11V8a4 4 0 0 1 8 0v3" />
							</svg>
						</span>
					{:else if isSelected}
						<span class="shrink-0 text-ice" aria-hidden="true">
							<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="3">
								<path d="m5 12 4 4 10-10" />
							</svg>
						</span>
					{/if}
				</label>
			{/each}
		</div>
	</div>
</fieldset>
