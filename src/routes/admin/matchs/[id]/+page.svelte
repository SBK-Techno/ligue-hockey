<script lang="ts">
	import { GAME_LIMITS } from '#config/games.ts';
	import { gameStatus } from '#config/game-status.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const game = $derived(data.game);
</script>

<FormFeedback {form} class="mb-4" />

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

	<div class="page-stack">
		{#if game.status === 'cancelled'}
			<div class="alert">
				<p class="font-semibold">{t('games.cancelledNotice')}</p>
			</div>
		{:else if game.status !== 'scheduled'}
			<div class="notice">{t('admin.gameNotScheduled')}</div>
		{:else if !data.editable}
			<div class="notice">{t('games.lineupLocked')}</div>
		{/if}

		<SectionCard title={t('games.details')}>
			{#if game.status === 'scheduled'}
				<form method="POST" action="?/update" use:progressiveForm class="grid gap-3 sm:grid-cols-2">
					<input type="hidden" name="expectedUpdatedAt" value={game.updatedAt} />
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
				<dl class="divide-y divide-line">
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
		</SectionCard>

		<SectionCard title={t('teams.title')}>
			<p class="text-body text-muted">{t('teams.adminHelp')}</p>
			<a class="btn-primary mt-4" href="/equipes/{game.id}">{t('teams.manage')}</a>
		</SectionCard>
		{#if game.status === 'scheduled' && data.editable}
			<SectionCard title={t('admin.dangerZone')}>
				<p class="text-body text-muted">{t('admin.cancelHelp')}</p>
				<form method="POST" action="?/cancel" use:progressiveForm class="mt-4">
					<ConfirmSubmit
						label={t('games.adminCancel')}
						question={t('admin.cancelGameQuestion', { date: formatDate(game.gameDate) })}
						confirmLabel={t('games.adminCancel')}
						cancelLabel={t('common.cancel')}
					/>
				</form>
			</SectionCard>
		{/if}
	</div>
{/if}
