<script lang="ts">
	import { gameRatingAttributes } from '#config/rating-attributes.ts';
	import { positionDefinition } from '#config/positions.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import RatingScale from '#lib/ui/RatingScale.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const assessment = $derived(data.assessment);
	const firstUnrated = $derived(
		assessment.players.find((player) => player.rated === 0)?.playerId ?? null
	);
</script>

<PageHeader
	title={t('rating.gameTitle')}
	meta="{formatDate(assessment.gameDate)} · {formatTime(assessment.startTime)} · {assessment.location}"
	back={{ href: '/admin/evaluations', label: t('admin.evaluationBack') }}
/>

<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
	<p class="font-mono text-xs text-muted">
		{t('rating.ratedPlayers', {
			done: assessment.ratedPlayers,
			total: assessment.players.length
		})}
	</p>
	<p class="text-[11px] text-muted">{t('rating.gameHelp')}</p>
</div>

{#if !assessment.canRate}
	<div class="notice mb-4">{t('rating.gameNotPlayed')}</div>
{/if}

<div class="space-y-2">
	{#each assessment.players as player (player.playerId)}
		{@const attributes = gameRatingAttributes(player.position)}
		<details
			class="sheet"
			name="assessment"
			open={player.playerId === firstUnrated}
		>
			<summary
				class="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5"
			>
				<span class="jersey">{player.jerseyNumber ?? '–'}</span>
				<span class="min-w-0 flex-1">
					<span class="block truncate text-sm font-semibold">{player.fullName}</span>
					<span class="mt-0.5 block text-xs text-muted">
						{t(positionDefinition(player.position).labelKey)}
					</span>
				</span>
				{#if form?.ok && form.playerId === player.playerId}
					<span class="badge-ok">{t('rating.saved')}</span>
				{:else}
					<span class="badge {player.rated > 0 ? 'badge-ok' : ''}">
						{player.rated}/{attributes.length}
					</span>
				{/if}
			</summary>

			<form
				method="POST"
				action="?/save"
				use:progressiveForm
				class="border-t border-line px-4 py-2"
			>
				<input type="hidden" name="playerId" value={player.playerId} />
				{#each attributes as attribute (attribute.key)}
					<RatingScale
						name={attribute.key}
						label={t(attribute.labelKey)}
						help={t(attribute.helpKey)}
						value={player.values[attribute.key]}
						clearable={assessment.canRate}
						disabled={!assessment.canRate}
					/>
				{/each}
				{#if assessment.canRate}
					<button class="btn-primary btn-sm mt-3 w-full sm:w-auto" type="submit">
						{t('common.save')}
					</button>
				{/if}
			</form>
		</details>
	{/each}
</div>
