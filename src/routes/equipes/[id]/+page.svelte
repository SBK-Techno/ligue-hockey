<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import { mapUrlFor } from '#config/maps.ts';
	import { formatDate, formatTime, formatTimestamp, t } from '#lib/shared/i18n/index.ts';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import MapLink from '#lib/ui/MapLink.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import StatStrip from '#lib/ui/StatStrip.svelte';
	import LineupBoard from '#lib/ui/match/LineupBoard.svelte';
	import TeamBoard from '#lib/ui/teams/TeamBoard.svelte';
	import TeamHistory from '#lib/ui/teams/TeamHistory.svelte';
	import TeamManagerPanel from '#lib/ui/teams/TeamManagerPanel.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const game = $derived(data.game);
	const status = $derived(game ? gameStatus(game.status) : null);
	const mapUrl = $derived(
		game ? mapUrlFor(game.locationAddress, game.locationMapUrl) : null
	);
	const viewerId = $derived(
		data.hasPlayerProfile && data.actor.kind === 'user' ? data.actor.userId : null
	);
	const managerEditor = $derived(
		Boolean(game && data.canManage && data.editable && game.generated)
	);
	/**
	 * The measured lineup, right where the alignment lives: only gaps the
	 * generation really measured, then the two team sizes from the live pool.
	 */
	const lineupStats = $derived.by(() => {
		const generation = game?.generation;
		const intelligence = data.intelligence;
		if (!generation || !intelligence) return [] as { value: string; label: string }[];
		const cells: { value: string; label: string }[] = [];
		if (generation.skillDiffLabel !== null) {
			cells.push({ value: generation.skillDiffLabel, label: t('games.gapSkill') });
		}
		if (generation.ageDiffLabel !== null) {
			cells.push({
				value: `${generation.ageDiffLabel} ${t('games.ageYears')}`,
				label: t('games.gapAge')
			});
		}
		cells.push({ value: String(intelligence.sizes.white), label: t('team.white') });
		cells.push({ value: String(intelligence.sizes.black), label: t('team.black') });
		return cells;
	});
	const sectionTitle = $derived(
		data.isNext && game?.status === 'scheduled'
			? t('teams.nextMatch')
			: data.isPastGame
				? t('teams.pastMatch')
				: t('teams.selectedMatch')
	);
</script>

<FormFeedback {form} class="mb-4" />

<PageHeader title={t('teams.title')} meta={t('teams.meta')}>
	{#snippet actions()}
		{#if game}
			{#if !data.isNext && data.nextGameId}
				<a class="btn-secondary btn-sm" href="/equipes/{data.nextGameId}">
					{t('teams.nextMatch')}
				</a>
			{/if}
			<a class="btn-secondary btn-sm" href="/matchs/{game.id}">{t('home.viewGame')}</a>
		{/if}
	{/snippet}
</PageHeader>

{#if !game}
	<EmptyState title={t('games.noMatch')} help={t('teams.noGamesHelp')} />
{:else}
	<div class="page-stack">
		<SectionCard title={sectionTitle}>
			{#snippet actions()}
				{#if status && !(data.isPastGame && game.status === 'scheduled')}
					<span class={badgeClass(status.tone)}>{t(status.labelKey)}</span>
				{/if}
				{#if data.isNext && game.status === 'scheduled'}
					<span class="badge-ice">{t('games.next')}</span>
				{/if}
			{/snippet}

			<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
				<div class="min-w-0">
					<p class="text-subhead font-semibold">{formatDate(game.gameDate)}</p>
					<p class="mt-1 text-body text-muted">
						{formatTime(game.startTime)} · {game.location}
					</p>
					{#if mapUrl}
						<MapLink href={mapUrl} class="mt-1" />
					{/if}
				</div>
				{#if game.generation}
					<p class="text-meta text-muted">
						{t('games.publishedAt', { date: formatTimestamp(game.generation.generatedAt) })}
					</p>
				{/if}
			</div>

			{#if game.notes}
				<div class="notice mt-3 whitespace-pre-wrap break-words">{game.notes}</div>
			{/if}

			{#if game.status === 'cancelled'}
				<div class="alert mt-3">
					<p class="font-semibold">{t('games.cancelledNotice')}</p>
				</div>
			{/if}
		</SectionCard>

		{#if game.status !== 'cancelled'}
			{#if managerEditor}
				{#if data.intelligence}
					<TeamManagerPanel {game} intelligence={data.intelligence} />
				{/if}

				<SectionCard title={t('games.roster')}>
					{#snippet actions()}
						<span class={game.lineupComplete ? 'badge-ok' : 'badge-alert'}>
							{game.lineupComplete ? t('games.generated') : t('games.rosterIncomplete')}
						</span>
					{/snippet}
					<FormFeedback {form} section="lineup" focusOnChange class="mb-3" />
					{#if lineupStats.length > 0}
						<div class="mb-3">
							<StatStrip cells={lineupStats} />
						</div>
					{/if}
					{#key `${game.id}:${game.generation?.generatedAt}`}
						<LineupBoard
							slots={game.slots}
							bench={game.generation?.bench ?? []}
							canEdit={data.canManage && data.editable}
							expectedGeneratedAt={game.generation?.generatedAt ?? null}
							actorId={viewerId}
							ownTeam={data.ownTeam}
						/>
					{/key}
				</SectionCard>
			{:else if game.generated}
				<SectionCard title={t('games.roster')}>
					{#snippet actions()}
						<span class={game.lineupComplete ? 'badge-ok' : 'badge-alert'}>
							{game.lineupComplete ? t('games.generated') : t('games.rosterIncomplete')}
						</span>
					{/snippet}
					<TeamBoard
						slots={game.slots}
						bench={game.generation?.bench ?? []}
						ownTeam={data.ownTeam}
						actorId={viewerId}
					/>
					{#if !game.lineupComplete}
						<p class="hint mt-3">{game.openSlotsLabel}</p>
					{/if}
					{#if !data.editable}
						<p class="hint mt-3">
							{game.status === 'completed' ? t('teams.pastHelp') : t('teams.lockedHelp')}
						</p>
					{/if}
				</SectionCard>
			{:else}
				<SectionCard title={t('teams.noLineup')}>
					{#if data.editable}
						<p class="text-body text-muted">
							{data.canManage ? t('games.lineupSoonAdmin') : t('teams.noLineupHelp')}
						</p>
						{#if data.canManage}
							<form method="POST" action="?/generate" use:progressiveForm class="mt-4">
								<button class="btn-primary" type="submit">{t('games.generate')}</button>
							</form>
							<p class="hint mt-2">{t('teams.generateHelp')}</p>
						{/if}
					{:else}
						<p class="text-body text-muted">{t('teams.noLineupPast')}</p>
					{/if}
				</SectionCard>
			{/if}
		{/if}

		<SectionCard title={t('teams.history')} flush>
			<p class="section-row text-meta text-muted">{t('teams.historyHelp')}</p>
			<TeamHistory entries={data.history} selectedId={game.id} />
			{#if data.hasMoreHistory}
				<p class="section-row border-t border-line text-meta text-muted">
					{t('teams.historyMore')}
					<a class="link" href="/matchs">{t('games.title')}</a>.
				</p>
			{/if}
		</SectionCard>
	</div>
{/if}
