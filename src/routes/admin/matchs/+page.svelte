<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const statusKey = {
		scheduled: 'games.status.scheduled',
		cancelled: 'games.status.cancelled',
		completed: 'games.status.completed'
	} as const;
</script>

{#if form?.message}
	<p class="success mb-4">{form.message}</p>
{/if}

<div class="mb-4">
	<h2>{t('admin.games')}</h2>
</div>

<section class="card mb-5">
	<h3 class="mb-3">{t('games.adminCreate')}</h3>
	<form method="POST" action="?/create" use:enhance class="grid gap-3 sm:grid-cols-2">
		<div>
			<label class="label" for="gameDate">{t('games.date')}</label>
			<input class="input" id="gameDate" name="gameDate" type="date" required />
		</div>
		<div>
			<label class="label" for="startTime">{t('games.time')}</label>
			<input class="input" id="startTime" name="startTime" type="time" value={data.defaults.time} required />
		</div>
		<div class="sm:col-span-2">
			<label class="label" for="location">{t('games.location')}</label>
			<input class="input" id="location" name="location" value={data.defaults.location} maxlength="120" required />
		</div>
		<div class="sm:col-span-2">
			<label class="label" for="notes">{t('games.notes')}</label>
			<textarea class="input" id="notes" name="notes" rows="2" maxlength="1000"></textarea>
		</div>
		<div class="sm:col-span-2">
			<button class="btn-primary" type="submit">{t('common.create')}</button>
		</div>
	</form>
</section>

{#if data.games.length === 0}
	<div class="card text-sm text-muted">{t('games.empty')}</div>
{:else}
	<ul class="space-y-2">
		{#each data.games as game (game.id)}
			<li>
				<a href="/admin/matchs/{game.id}" class="card flex flex-wrap items-center justify-between gap-3 no-underline hover:border-ice">
					<div>
						<p class="font-semibold text-ink">{formatDate(game.gameDate)}</p>
						<p class="text-sm text-muted">{formatTime(game.startTime)} · {game.location}</p>
					</div>
					<span class="badge {game.status === 'scheduled' ? 'badge-ok' : ''}">
						{t(statusKey[game.status])}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
