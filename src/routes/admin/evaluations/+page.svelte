<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
	import type { EvaluationOverview } from '#lib/domain/ratings/service.ts';
	import {
		formatCount,
		formatDate,
		formatDecimal,
		formatTime,
		t
	} from '#lib/shared/i18n/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import RecordRow from '#lib/ui/RecordRow.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let showComplete = $state(false);

	const incomplete = $derived(data.overviews.filter((player) => !player.complete));
	const complete = $derived(data.overviews.filter((player) => player.complete));
	const games = $derived(
		[...data.games].sort(
			(a, b) =>
				Number(a.complete) - Number(b.complete) ||
				b.gameDate.localeCompare(a.gameDate) ||
				b.startTime.localeCompare(a.startTime)
		)
	);
	const incompleteGames = $derived(data.games.filter((game) => !game.complete));
</script>

{#snippet playerRow(player: EvaluationOverview)}
	<li>
		<RecordRow
			href="/admin/evaluations/{player.playerId}"
			title={player.fullName}
			meta="{t(positionDefinition(player.position).labelKey)} · {t(
				'rating.positionCriteria',
				{
					done: player.positionCompleted,
					total: player.positionTotal
				}
			)}"
			trailing={player.overall === null
				? t('rating.notRated')
				: formatDecimal(player.overall, 2)}
			badge={player.complete
				? t('admin.seasonComplete')
				: t('admin.seasonIncomplete')}
			badgeTone={player.complete ? 'ok' : 'neutral'}
		/>
	</li>
{/snippet}

<PageHeader title={t('rating.title')} meta={t('rating.description')} />

<div class="page-stack">
	{#if data.overviews.length === 0}
		<EmptyState title={t('admin.evaluationsEmpty')} />
	{:else}
		<SectionCard title={t('admin.evaluationsSeason')} flush>
			{#snippet actions()}
				{#if complete.length > 0}
					<button
						class="btn-secondary btn-sm"
						type="button"
						aria-expanded={showComplete}
						onclick={() => (showComplete = !showComplete)}
					>
						{showComplete
							? t('admin.hideComplete')
							: formatCount(
									complete.length,
									'admin.showComplete.one',
									'admin.showComplete.many'
								)}
					</button>
				{/if}
			{/snippet}
			<p class="section-row hint">
				{t('admin.evaluationsProgress', {
					done: complete.length,
					total: data.overviews.length
				})}
			</p>
			{#if incomplete.length === 0}
				<p class="section-row text-body font-semibold">
					{t('admin.evaluationsAllComplete')}
				</p>
			{:else}
				<ul role="list" class="divide-y divide-line">
					{#each incomplete as player (player.playerId)}
						{@render playerRow(player)}
					{/each}
				</ul>
			{/if}
			{#if showComplete && complete.length > 0}
				<p class="section-row micro-label border-t border-line">
					{t('admin.seasonComplete')} · {complete.length}
				</p>
				<ul role="list" class="divide-y divide-line">
					{#each complete as player (player.playerId)}
						{@render playerRow(player)}
					{/each}
				</ul>
			{/if}
		</SectionCard>
	{/if}

	{#if data.games.length === 0}
		<EmptyState title={t('rating.noPlayedGames')} />
	{:else}
		<SectionCard title={t('admin.evaluationsGames')} flush>
			{#snippet actions()}
				<span class="text-meta text-muted">
					{incompleteGames.length > 0
						? formatCount(
								incompleteGames.length,
								'admin.gamesToRate.one',
								'admin.gamesToRate.many'
							)
						: t('admin.gamesAllRated')}
				</span>
			{/snippet}
			<ul role="list" class="divide-y divide-line">
				{#each games as game (game.gameId)}
					<li>
						<RecordRow
							href="/admin/evaluations/matchs/{game.gameId}"
							title="{formatTime(game.startTime)} · {game.location}"
							meta={formatDate(game.gameDate, 'short')}
							badge="{game.rated}/{game.players}"
							badgeLabel={formatCount(
								game.rated,
								'rating.ratedPlayers.one',
								'rating.ratedPlayers.many',
								{ total: game.players }
							)}
							badgeTone={game.rated === 0
								? 'neutral'
								: game.complete
									? 'ok'
									: 'ice'}
						/>
					</li>
				{/each}
			</ul>
		</SectionCard>
	{/if}
</div>
