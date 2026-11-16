<script lang="ts">
	import { GAME_LIMITS } from '#lib/domain/games/validators.ts';
	import { gameStatus } from '#config/game-status.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const game = $derived(data.game);

</script>

<FormFeedback {form} class="mb-4" />

{#if !game}
	<div class="card">
		<h1>{t('games.noMatch')}</h1>
		<a class="btn-secondary mt-4" href="/admin/matchs">{t('admin.backToGames')}</a>
	</div>
{:else}
	<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<div>
			<a class="link text-sm" href="/admin/matchs">{t('admin.backToGames')}</a>
			<h1 class="mt-2 capitalize">{formatDate(game.gameDate)}</h1>
			<p class="mt-1.5 text-sm text-muted">
				{formatTime(game.startTime)} · {game.location}
				· <span class="badge">{t(gameStatus(game.status).labelKey)}</span>
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if data.canAssess}
				<a class="btn-primary btn-sm" href="/admin/evaluations/matchs/{game.id}">
					{t('rating.editGame')}
				</a>
			{/if}
			<a class="btn-secondary btn-sm" href="/matchs/{game.id}">{t('home.viewGame')}</a>
		</div>
	</div>

	{#if game.status === 'cancelled'}
		<div class="alert mb-4">
			<p class="font-semibold">{t('games.cancelledNotice')}</p>
		</div>
	{:else if game.status !== 'scheduled'}
		<div class="notice mb-4">{t('admin.gameNotScheduled')}</div>
	{/if}

	<section class="card mb-4">
		<h2 class="mb-3">{t('games.adminEdit')}</h2>
		<form method="POST" action="?/update" use:progressiveForm class="grid gap-3 sm:grid-cols-2">
			<div>
				<label class="label" for="gameDate">{t('games.date')}</label>
				<input
					class="input"
					id="gameDate"
					name="gameDate"
					type="date"
					value={game.gameDate}
					required
					disabled={game.status !== 'scheduled'}
				/>
			</div>
			<div>
				<label class="label" for="startTime">{t('games.time')}</label>
				<input
					class="input"
					id="startTime"
					name="startTime"
					type="time"
					value={game.startTime}
					required
					disabled={game.status !== 'scheduled'}
				/>
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="location">{t('games.location')}</label>
				<input
					class="input"
					id="location"
					name="location"
					value={game.location}
					maxlength={GAME_LIMITS.locationMax}
					required
					disabled={game.status !== 'scheduled'}
				/>
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="notes">{t('games.notes')}</label>
				<textarea
					class="input"
					id="notes"
					name="notes"
					rows="3"
					maxlength={GAME_LIMITS.notesMax}
					disabled={game.status !== 'scheduled'}>{game.notes ?? ''}</textarea
				>
			</div>
			<div class="flex flex-wrap gap-2 sm:col-span-2">
				<button class="btn-primary" type="submit" disabled={game.status !== 'scheduled'}>
					{t('common.save')}
				</button>
			</div>
		</form>
	</section>

	<section class="card mb-4">
		<div class="section-title">
			<h2>{t('team.balance')}</h2>
			{#if game.generated}
				<span class="badge-ice">{t('games.generated')}</span>
			{:else}
				<span class="badge">{t('games.notGenerated')}</span>
			{/if}
		</div>
		<p class="mt-2 text-sm text-muted">
			{#if game.generated}
				{t('admin.generatedSummary', {
					players: game.slots.filter((slot) => slot.player).length,
					open: game.openSlots
				})}
			{:else}
				{t('games.lineupSoon')}
			{/if}
		</p>
		{#if game.generated && game.generation?.skillDiffLabel && game.generation.ageDiffLabel}
			<p class="mt-1 text-sm text-muted">
				{t('games.teamBalance', {
					skill: game.generation.skillDiffLabel,
					age: game.generation.ageDiffLabel
				})}
			</p>
		{/if}
		<form method="POST" action="?/generate" use:progressiveForm class="mt-4">
			<button class="btn-secondary" type="submit" disabled={game.status !== 'scheduled'}>
				{game.generated ? t('games.regenerate') : t('games.generate')}
			</button>
		</form>
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
				/>
			</form>
		</section>
	{/if}
{/if}
