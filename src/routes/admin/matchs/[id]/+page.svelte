<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const game = $derived(data.game);

	const statusKey = {
		scheduled: 'games.status.scheduled',
		cancelled: 'games.status.cancelled',
		completed: 'games.status.completed'
	} as const;
</script>

{#if form?.message}
	<p class="success mb-4">{form.message}</p>
{/if}

{#if !game}
	<div class="card">{t('games.noMatch')}</div>
{:else}
	<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<div>
			<a class="text-sm font-semibold text-ice" href="/admin/matchs">← {t('admin.games')}</a>
			<h2 class="mt-2">{formatDate(game.gameDate)}</h2>
			<p class="mt-1 text-sm text-muted">
				{formatTime(game.startTime)} · {game.location}
				· <span class="badge">{t(statusKey[game.status])}</span>
			</p>
		</div>
		<a class="btn-secondary btn-sm" href="/matchs/{game.id}">{t('home.viewGame')}</a>
	</div>

	<section class="card mb-4">
		<h3 class="mb-3">{t('games.adminEdit')}</h3>
		<form method="POST" action="?/update" use:enhance class="grid gap-3 sm:grid-cols-2">
			<div>
				<label class="label" for="gameDate">{t('games.date')}</label>
				<input class="input" id="gameDate" name="gameDate" type="date" value={game.gameDate} required />
			</div>
			<div>
				<label class="label" for="startTime">{t('games.time')}</label>
				<input class="input" id="startTime" name="startTime" type="time" value={game.startTime} required />
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="location">{t('games.location')}</label>
				<input class="input" id="location" name="location" value={game.location} maxlength="120" required />
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="notes">{t('games.notes')}</label>
				<textarea class="input" id="notes" name="notes" rows="3" maxlength="1000">{game.notes ?? ''}</textarea>
			</div>
			<div class="flex flex-wrap gap-2 sm:col-span-2">
				<button class="btn-primary" type="submit" disabled={game.status !== 'scheduled'}>
					{t('common.save')}
				</button>
			</div>
		</form>
	</section>

	<div class="flex flex-wrap gap-2">
		<form method="POST" action="?/generate" use:enhance>
			<button class="btn-primary" type="submit" disabled={game.status !== 'scheduled'}>
				{game.generated ? t('games.regenerate') : t('games.generate')}
			</button>
		</form>
		<form method="POST" action="?/cancel" use:enhance>
			<button class="btn-danger" type="submit" disabled={game.status !== 'scheduled'}>
				{t('games.adminCancel')}
			</button>
		</form>
	</div>
{/if}
