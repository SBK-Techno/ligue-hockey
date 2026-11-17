<script lang="ts">
	import { AVATARS } from '#config/avatars.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import Avatar from './Avatar.svelte';

	let {
		name = 'avatarId',
		selected,
		taken = [],
		help = t('profile.avatarHelp')
	}: {
		name?: string;
		selected: string;
		taken?: readonly string[];
		help?: string;
	} = $props();

	const id = $props.id();
	const helpId = `${id}-help`;
	const takenSet = $derived(new Set(taken));
	// Snapshot the saved avatar for the editable radio group; a failed submit
	// keeps the player's choice visible.
	// svelte-ignore state_referenced_locally
	let current = $state(selected);
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
</fieldset>
