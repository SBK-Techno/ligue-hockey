<script lang="ts">
	import { GAME_LIMITS } from '#lib/domain/games/validators.ts';
	import { gameStatus } from '#config/game-status.ts';
	import { TEAMS, teamDefinition } from '#config/teams.ts';
	import { formatCount, formatDate, formatDecimal, formatTime, t } from '#lib/shared/i18n/index.ts';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import StatStrip from '#lib/ui/StatStrip.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const game = $derived(data.game);
	const intelligence = $derived(data.intelligence);
	const missingRatings = $derived([
		...new Set([
			...data.ratingsMissing.map((player) => player.fullName),
			...(intelligence?.unratedNames ?? [])
		])
	]);
	function formatAverage(value: number | null | undefined): string {
		return value == null ? t('rating.notAvailable') : formatDecimal(value, 2);
	}
	const statCells = $derived([
		...TEAMS.map((team) => ({
			label: t('games.average', { team: t(teamDefinition(team.key).labelKey) }),
			value: formatAverage(intelligence?.averages[team.key])
		})),
		{
			label: t('games.skillGap'),
			value:
				intelligence?.skillDiff == null
					? t('rating.notAvailable')
					: formatDecimal(intelligence.skillDiff, 2)
		},
		{
			label: t('games.ageGap'),
			value: intelligence
				? formatDecimal(intelligence.ageDiff, 1)
				: t('rating.notAvailable')
		}
	]);
</script>

{#if !game}
	<PageHeader title={t('games.noMatch')} back={{ href: '/admin/matchs', label: t('admin.backToGames') }} />
	<a class="btn-secondary" href="/admin/matchs">{t('common.back')}</a>
{:else}
	<PageHeader
		title={formatDate(game.gameDate)}
		meta="{formatTime(game.startTime)} · {game.location}"
		back={{ href: '/admin/matchs', label: t('admin.backToGames') }}
	>
		{#snippet actions()}
			<span class={badgeClass(gameStatus(game.status).tone)}>
				{t(gameStatus(game.status).labelKey)}
			</span>
			{#if data.canAssess}
				<a class="btn-primary btn-sm" href="/admin/evaluations/matchs/{game.id}">
					{t('rating.editGame')}
				</a>
			{/if}
			<a class="btn-secondary btn-sm" href="/matchs/{game.id}">{t('home.viewGame')}</a>
		{/snippet}
	</PageHeader>

	{#if missingRatings.length > 0}
		<div class="alert mb-4">
			<p class="font-semibold">{t('games.ratingsMissing')}</p>
			<p class="mt-1 text-sm">
				{t('games.ratingsMissingNames', { names: missingRatings.join(', ') })}
			</p>
			<p class="mt-1 text-sm">{t('games.ratingsMissingHelp')}</p>
			<a class="btn-secondary btn-sm mt-3" href="/admin/evaluations/matchs/{game.id}">
				{t('games.ratingsMissingLink')}
			</a>
		</div>
	{/if}

	{#if game.status === 'cancelled'}
		<div class="alert mb-4">
			<p class="font-semibold">{t('games.cancelledNotice')}</p>
		</div>
	{:else if game.status !== 'scheduled'}
		<div class="notice mb-4">{t('admin.gameNotScheduled')}</div>
	{:else if !data.editable}
		<div class="notice mb-4">{t('games.lineupLocked')}</div>
	{/if}

	<section class="card mb-4">
		<h2 class="mb-3">{t('games.details')}</h2>
		{#if game.status === 'scheduled'}
			<form method="POST" action="?/update" use:progressiveForm class="grid gap-3 sm:grid-cols-2">
				<div>
					<label class="label" for="gameDate">{t('games.date')}</label>
					<input class="input" id="gameDate" name="gameDate" type="date" value={game.gameDate} required />
				</div>
				<div>
					<label class="label" for="startTime">{t('games.time')}</label>
					<input class="input" id="startTime" name="startTime" type="time" value={game.startTime} required />
				</div>
				<div class="sm:col-span-2">
					<label class="label" for="locationId">{t('games.location')}</label>
					<select class="input" id="locationId" name="locationId" value={game.locationId} required>
						{#each data.locations as location (location.id)}
							<option value={location.id}>{location.name}</option>
						{/each}
					</select>
				</div>
				<div class="sm:col-span-2">
					<label class="label" for="notes">{t('games.notes')}</label>
					<textarea
						class="input"
						id="notes"
						name="notes"
						rows="3"
						maxlength={GAME_LIMITS.notesMax}>{game.notes ?? ''}</textarea
					>
				</div>
				<div class="flex flex-wrap gap-2 sm:col-span-2">
					<button class="btn-primary" type="submit">{t('common.save')}</button>
				</div>
			</form>
		{:else}
			<dl class="mt-3 divide-y divide-line">
				<div class="fact"><dt>{t('games.date')}</dt><dd>{formatDate(game.gameDate)}</dd></div>
				<div class="fact"><dt>{t('games.time')}</dt><dd>{formatTime(game.startTime)}</dd></div>
				<div class="fact"><dt>{t('games.location')}</dt><dd>{game.location}</dd></div>
				{#if game.notes}
					<div class="fact">
						<dt>{t('games.notes')}</dt>
						<dd class="whitespace-pre-wrap break-words text-right">{game.notes}</dd>
					</div>
				{/if}
			</dl>
		{/if}
	</section>

	<section class="card mb-4">
		<div class="section-title">
			<h2>{t('games.roster')}</h2>
			{#if game.generated}
				<span class="badge-ice">{t('games.generated')}</span>
			{:else}
				<span class="badge">{t('games.notGenerated')}</span>
			{/if}
		</div>

		{#if game.generated && intelligence}
			<div class="mt-4 flex flex-wrap items-start justify-between gap-4">
				<StatStrip cells={statCells} />
				<FormFeedback {form} />
			</div>

			<div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/70 pt-3">
				{#each TEAMS as team (team.key)}
					<p class="text-sm text-muted">
						{t('games.teamSize', {
							team: t(teamDefinition(team.key).labelKey),
							count: intelligence.sizes[team.key]
						})}
					</p>
				{/each}
				<p class="text-sm text-muted">
					{formatCount(
						intelligence.placed,
						'games.filledPlaces.one',
						'games.filledPlaces.many'
					)}
				</p>
				<p class="text-sm text-muted">{game.openSlotsLabel}</p>
				<p class="text-sm text-muted">
					{t('games.sizeGap', { count: intelligence.sizeDiff })}
				</p>
				<div class="ml-auto flex flex-wrap gap-2">
					{#if game.status === 'scheduled'}
						<form method="POST" action="?/generate" use:progressiveForm>
							{#if game.generated}
								<ConfirmSubmit
									label={t('games.regenerate')}
									title={t('games.regenerate')}
									question={t('games.regenerateConfirm')}
									confirmLabel={t('games.regenerate')}
									cancelLabel={t('common.cancel')}
									tone="neutral"
									class="btn-secondary btn-sm"
								/>
							{:else}
								<button class="btn-primary btn-sm" type="submit">{t('games.generate')}</button>
							{/if}
						</form>
					{/if}
				</div>
			</div>

			{#if !intelligence.complete}
				<div class="notice mt-4">
					<p class="font-semibold">{t('games.rosterIncomplete')}</p>
					<p class="mt-1 text-sm leading-snug">{t('games.incomplete')}</p>
					<p class="mt-1 text-sm">
						{t('games.sizeGap', { count: intelligence.sizeDiff })}
					</p>
				</div>
			{:else if data.editable && intelligence.swap}
				<div class="notice mt-4">
					<p class="font-semibold">{t('games.bestSwap')}</p>
					<p class="mt-1 text-sm leading-snug">
						{t('games.bestSwapHelp', {
							a: intelligence.swap.nameA,
							b: intelligence.swap.nameB,
							before: formatDecimal(intelligence.swap.skillDiffBefore, 2),
							after: formatDecimal(intelligence.swap.skillDiffAfter, 2)
						})}
					</p>
					<p class="mt-1 text-sm">
						{t('games.bestSwapAge', {
							before: formatDecimal(intelligence.swap.ageDiffBefore, 1),
							after: formatDecimal(intelligence.swap.ageDiffAfter, 1)
						})}
					</p>
					<form method="POST" action="?/swap" use:progressiveForm class="mt-2">
						<ConfirmSubmit
							label={t('games.applySwap')}
							title={t('games.bestSwap')}
							question={t('games.swapConfirm', {
								a: intelligence.swap.nameA,
								b: intelligence.swap.nameB,
								before: formatDecimal(intelligence.swap.skillDiffBefore, 2),
								after: formatDecimal(intelligence.swap.skillDiffAfter, 2),
								ageBefore: formatDecimal(intelligence.swap.ageDiffBefore, 1),
								ageAfter: formatDecimal(intelligence.swap.ageDiffAfter, 1)
							})}
							confirmLabel={t('games.applySwap')}
							cancelLabel={t('common.cancel')}
							tone="neutral"
							class="btn-secondary btn-sm"
						/>
					</form>
				</div>
			{:else}
				<p class="hint mt-3">{t('games.alreadyBalanced')}</p>
			{/if}

			{#if data.editable && intelligence.fills.count > 0}
				<div class="mt-3 border border-line p-3">
					<p class="text-sm font-semibold">{t('games.fillSlots')}</p>
					<p class="hint mt-1">
						{formatCount(
							intelligence.fills.count,
							'games.fillSlotsHelp.one',
							'games.fillSlotsHelp.many'
						)}
						{intelligence.fills.names.join(', ')}
					</p>
					<form method="POST" action="?/fill" use:progressiveForm class="mt-2">
						<button class="btn-secondary btn-sm" type="submit">{t('games.fillSlots')}</button>
					</form>
				</div>
			{/if}

			{#if intelligence.benchNames.length > 0}
				<p class="micro-label mt-4">{t('games.bench')}</p>
				<p class="mt-1 text-sm text-muted">{intelligence.benchNames.join(', ')}</p>
			{/if}
		{:else}
			<p class="mt-2 text-sm text-muted">{t('games.lineupSoon')}</p>
			{#if game.status === 'scheduled'}
				<form method="POST" action="?/generate" use:progressiveForm class="mt-3">
					<button class="btn-primary" type="submit">{t('games.generate')}</button>
				</form>
			{/if}
		{/if}
	</section>

	{#if game.status === 'scheduled'}
		<section class="card border-alert/30">
			<h2 class="text-alert">{t('admin.dangerZone')}</h2>
			<p class="mt-1 text-sm text-muted">{t('admin.cancelHelp')}</p>
			<form method="POST" action="?/cancel" use:progressiveForm class="mt-4">
				<ConfirmSubmit
					label={t('games.adminCancel')}
					question={t('admin.cancelGameQuestion', { date: formatDate(game.gameDate) })}
					confirmLabel={t('games.adminCancel')}
					cancelLabel={t('common.cancel')}
				/>
			</form>
		</section>
	{/if}
{/if}
