<script lang="ts">
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const statusKey = {
		scheduled: 'games.status.scheduled',
		cancelled: 'games.status.cancelled',
		completed: 'games.status.completed'
	} as const;
</script>

<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1>{t('games.title')}</h1>
		<p class="mt-1 text-sm text-muted">{t('games.subtitle')}</p>
	</div>
	{#if data.actor.kind === 'user' && data.actor.role === 'admin'}
		<a class="btn-primary btn-sm" href="/admin/matchs">{t('games.adminCreate')}</a>
	{/if}
</div>

<h2 class="mb-3">{t('games.upcoming')}</h2>
{#if data.upcoming.length === 0}
	<div class="card text-sm text-muted">{t('games.empty')}</div>
{:else}
	<ul class="space-y-3">
		{#each data.upcoming as game (game.id)}
			<li>
				<a
					href="/matchs/{game.id}"
					class="card block no-underline transition-colors hover:border-ice"
				>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h3 class="text-base normal-case tracking-normal text-ink">
								{formatDate(game.gameDate)}
							</h3>
							<p class="mt-1 text-sm text-muted">
								{formatTime(game.startTime)} · {game.location}
							</p>
						</div>
						<span class="badge-ok">{t('games.status.scheduled')}</span>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}

{#if data.past.length > 0}
	<h2 class="mb-3 mt-8">{t('games.past')}</h2>
	<ul class="space-y-2">
		{#each data.past as game (game.id)}
			<li>
				<a href="/matchs/{game.id}" class="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm no-underline hover:border-ice">
					<span class="font-semibold text-ink">{formatDate(game.gameDate, 'short')}</span>
					<span class="text-muted">{formatTime(game.startTime)} · {game.location}</span>
					<span class="badge">{t(statusKey[game.status])}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
