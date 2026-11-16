<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import { GAME_LIMITS } from '#lib/domain/games/validators.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

</script>

<FormFeedback {form} class="mb-4" />

<div class="mb-5">
	<h1>{t('admin.games')}</h1>
	<p class="mt-1.5 text-sm text-muted">{t('admin.gamesHelp')}</p>
</div>

<section class="card mb-5">
	<h2 class="mb-3">{t('games.adminCreate')}</h2>
	<form method="POST" action="?/create" use:progressiveForm class="grid gap-3 sm:grid-cols-2">
		<div>
			<label class="label" for="gameDate">{t('games.date')}</label>
			<input class="input" id="gameDate" name="gameDate" type="date" value={data.defaults.date} required />
		</div>
		<div>
			<label class="label" for="startTime">{t('games.time')}</label>
			<input class="input" id="startTime" name="startTime" type="time" value={data.defaults.time} required />
		</div>
		<div class="sm:col-span-2">
			<label class="label" for="location">{t('games.location')}</label>
			<input class="input" id="location" name="location" value={data.defaults.location} maxlength={GAME_LIMITS.locationMax} required />
		</div>
		<div class="sm:col-span-2">
			<label class="label" for="notes">{t('games.notes')}</label>
			<textarea class="input" id="notes" name="notes" rows="2" maxlength={GAME_LIMITS.notesMax}></textarea>
		</div>
		<div class="sm:col-span-2">
			<button class="btn-primary" type="submit">{t('games.adminCreate')}</button>
		</div>
	</form>
</section>

{#if data.games.length === 0}
	<div class="card">
		<p class="text-sm text-muted">{t('games.empty')}</p>
		<p class="hint">{t('games.emptyHelp')}</p>
	</div>
{:else}
	<ul role="list" class="space-y-2">
		{#each data.games as game (game.id)}
			<li>
				<a href="/admin/matchs/{game.id}" class="card card-link flex flex-wrap items-center justify-between gap-3 py-3.5">
					<div>
						<p class="font-semibold capitalize text-ink">{formatDate(game.gameDate)}</p>
						<p class="mt-0.5 text-sm text-muted">{formatTime(game.startTime)} · {game.location}</p>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						{#if game.status === 'cancelled'}
							<span class="badge-alert">{t('games.status.cancelled')}</span>
						{:else}
							<span class="badge">{t(gameStatus(game.status).labelKey)}</span>
						{/if}
						{#if game.generated}
							<span class="badge-ice">{t('games.generated')}</span>
						{:else if game.status === 'scheduled'}
							<span class="badge">{t('games.notGenerated')}</span>
						{/if}
						{#if game.generated && game.openSlots > 0}
							<span class="badge-alert">{game.openSlotsLabel}</span>
						{/if}
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}
