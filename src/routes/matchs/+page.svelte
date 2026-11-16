<script lang="ts">
	import type { I18nKey } from '#config/i18n/fr.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { formatDate, formatTime, formatWeekday, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const isManager = $derived(data.actor.kind === 'user' && can(data.actor, 'manageGames'));

	const statusKey: Record<string, I18nKey> = {
		scheduled: 'games.status.scheduled',
		cancelled: 'games.status.cancelled',
		completed: 'games.status.completed'
	};
</script>

<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1>{t('games.title')}</h1>
		<p class="mt-1.5 text-sm text-muted">{t('games.subtitle')}</p>
	</div>
	{#if isManager}
		<a class="btn-primary btn-sm" href="/admin/matchs">{t('games.adminCreate')}</a>
	{/if}
</div>

<h2 class="mb-3">{t('games.upcoming')}</h2>
{#if data.upcoming.length === 0}
	<div class="card">
		<p class="text-sm text-muted">{t('games.empty')}</p>
		<p class="hint">{isManager ? t('home.noGameHelpAdmin') : t('games.emptyHelp')}</p>
		{#if isManager}
			<a class="btn-primary btn-sm mt-3" href="/admin/matchs">{t('home.createGame')}</a>
		{/if}
	</div>
{:else}
	<ul role="list" class="space-y-2.5">
		{#each data.upcoming as game, index (game.id)}
			<li>
				<a
					href="/matchs/{game.id}"
					class="card card-link flex items-center gap-4 py-3.5"
				>
					<div class="w-16 shrink-0 border-r border-line/80 pr-3 text-center">
						<p class="text-[11px] font-semibold capitalize text-muted">
							{formatWeekday(game.gameDate)}
						</p>
						<p class="font-display text-2xl font-bold leading-tight text-ink">
							{formatDate(game.gameDate, 'short')}
						</p>
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold text-ink">
							{formatTime(game.startTime)} · {game.location}
						</p>
					</div>
					{#if index === 0 && game.status === 'scheduled'}
						<span class="badge-ice shrink-0">{t('games.next')}</span>
					{:else if game.status === 'cancelled'}
						<span class="badge-alert shrink-0">{t('games.status.cancelled')}</span>
					{:else}
						<span class="badge shrink-0">{t(statusKey[game.status] ?? 'games.status.scheduled')}</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
{/if}

{#if data.past.length > 0}
	<h2 class="mb-3 mt-8">{t('games.past')}</h2>
	<ul role="list" class="space-y-1.5">
		{#each data.past as game (game.id)}
			<li>
				<a
					href="/matchs/{game.id}"
					class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-line/80 bg-surface px-4 py-3 text-sm no-underline transition-colors hover:border-ink/25"
				>
					<span class="font-semibold text-ink">{formatDate(game.gameDate, 'year')}</span>
					<span class="text-muted">{formatTime(game.startTime)} · {game.location}</span>
					<span class="ml-auto badge {game.status === 'cancelled' ? 'badge-alert' : 'badge'}">
						{t(statusKey[game.status] ?? 'games.status.scheduled')}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
