<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
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
</script>

<PageHeader title={t('rating.title')} meta={t('rating.description')} />

<div class="page-stack">
	{#if data.overviews.length === 0}
		<EmptyState title={t('admin.evaluationsEmpty')} />
	{:else}
		<SectionCard title={t('admin.evaluationsSeason')} flush>
			<ul role="list" class="divide-y divide-line">
				{#each data.overviews as player (player.playerId)}
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
				{/each}
			</ul>
		</SectionCard>
	{/if}

	{#if data.games.length === 0}
		<EmptyState title={t('rating.noPlayedGames')} />
	{:else}
		<SectionCard title={t('admin.evaluationsGames')} flush>
			<ul role="list" class="divide-y divide-line">
				{#each data.games as game (game.gameId)}
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
