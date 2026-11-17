<script lang="ts">
	import { AVATARS } from '#config/avatars.ts';
	import { legendForIdentity } from '#config/identities.ts';
	import { legendsForPosition } from '#config/legends.ts';
	import type { Position } from '#config/positions.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import Avatar from './Avatar.svelte';

	let {
		name = 'avatarId',
		selected,
		taken = [],
		help = t('profile.avatarHelp'),
		position = null
	}: {
		name?: string;
		selected: string;
		taken?: readonly string[];
		help?: string;
		position?: Position | null;
	} = $props();

	const id = $props.id();
	const helpId = `${id}-help`;
	const legendHelpId = `${id}-legends`;
	const takenSet = $derived(new Set(taken));
	// Snapshot the saved avatar for the editable radio group; a failed submit
	// keeps the player's choice visible.
	// svelte-ignore state_referenced_locally
	let current = $state(selected);

	const selectedLegend = $derived(legendForIdentity(current));
	const positionLegends = $derived(position ? legendsForPosition(position) : []);
	/**
	 * A saved legend stays visible even when the chosen position no longer
	 * matches, so the radio group always has a checked card to submit.
	 */
	const legendOptions = $derived.by(() => {
		if (
			selectedLegend &&
			!positionLegends.some((legend) => legend.id === selectedLegend.id)
		) {
			return [selectedLegend, ...positionLegends];
		}
		return positionLegends;
	});

	function isMismatch(legendPosition: Position): boolean {
		return position !== null && legendPosition !== position;
	}
</script>

<fieldset class="min-w-0" aria-describedby={helpId}>
	<legend class="label">{t('profile.avatar')}</legend>
	<p id={helpId} class="hint">{help}</p>
	<div class="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6 sm:gap-2 lg:grid-cols-7">
		{#each AVATARS as avatar, index (avatar.id)}
			{@const isTaken = takenSet.has(avatar.id)}
			{@const isSelected = current === avatar.id}
			{@const label = isTaken
				? t('profile.avatarOptionTaken', { number: index + 1 })
				: t('profile.avatarOption', { number: index + 1 })}
			<label
				class="relative flex min-w-0 flex-col items-center rounded-control border p-1 transition-colors has-[:checked]:border-ice has-[:checked]:bg-ice-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ice {isTaken
					? 'cursor-not-allowed border-line bg-paper-deep/40 opacity-50'
					: 'cursor-pointer border-line bg-surface hover:border-ice'}"
				title={label}
			>
				<input
					class="sr-only"
					type="radio"
					{name}
					value={avatar.id}
					bind:group={current}
					disabled={isTaken}
					aria-label={label}
				/>
				<Avatar
					player={{ fullName: label, userId: avatar.id, avatarId: avatar.id }}
					size={48}
					peek={false}
				/>
				{#if isTaken}
					<span class="mt-0.5 text-stamp font-semibold text-muted">{t('profile.avatarTaken')}</span>
				{/if}
				{#if isSelected}
					<span
						class="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ice text-on-brand shadow-card"
						aria-hidden="true"
					>
						<svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3">
							<path d="m5 12 4 4 10-10" />
						</svg>
					</span>
				{/if}
			</label>
		{/each}
	</div>

	<div class="mt-5 border-t border-line pt-4" aria-describedby={legendHelpId}>
		<h3 class="text-subhead font-semibold">{t('profile.legendsTitle')}</h3>
		<p id={legendHelpId} class="hint">{t('profile.legendsDisclaimer')}</p>
		{#if !position}
			<p class="mt-2 text-meta text-muted">{t('profile.legendsNeedPosition')}</p>
		{:else}
			<p class="mt-2 text-meta text-muted">{t('profile.legendsHelp')}</p>
		{/if}

		{#if legendOptions.length > 0}
			<div class="mt-3 grid gap-2 sm:grid-cols-2">
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
							? 'cursor-not-allowed border-line bg-paper-deep/40 opacity-50'
							: 'cursor-pointer border-line bg-surface hover:border-ice'}"
						title={label}
					>
						<input
							class="sr-only"
							type="radio"
							{name}
							value={legend.id}
							bind:group={current}
							disabled={isTaken}
							aria-label={label}
						/>
						<Avatar
							player={{ fullName: legend.name, userId: legend.id, avatarId: legend.id }}
							size={48}
							peek={false}
						/>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-meta font-semibold">{legend.name}</span>
							<span class="block font-mono text-caption text-muted">
								#{legend.number} · {legend.era}
							</span>
							{#if isMismatch(legend.position)}
								<span class="mt-0.5 block text-stamp text-muted">
									{t('profile.legendMismatch')}
								</span>
							{/if}
						</span>
						{#if isTaken}
							<span class="stamp shrink-0">{t('profile.avatarTaken')}</span>
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
		{/if}
	</div>
</fieldset>
