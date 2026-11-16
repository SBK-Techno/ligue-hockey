<script lang="ts">
	import { can } from '#lib/domain/auth/policy.ts';
	import { gameStatus } from '#config/game-status.ts';
	import { formatDate, formatTime, formatWeekday, t } from '#lib/shared/i18n/index.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const isManager = $derived(data.actor.kind === 'user' && can(data.actor, 'manageGames'));
</script>

<PageHeader title={t('games.title')} meta={t('games.subtitle')}>
	{#snippet actions()}
		{#if isManager}
			<a class="btn-primary btn-sm" href="/admin/matchs">{t('games.adminCreate')}</a>
		{/if}
	{/snippet}
</PageHeader>

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
				<a href="/matchs/{game.id}" class="card card-link flex items-center gap-4 py-3.5">
					<span class="w-14 shrink-0 border-r border-line pr-3">
						<span class="block text-xs font-semibold capitalize text-muted">
							{formatWeekday(game.gameDate)}
						</span>
						<span class="numeric mt-0.5 block text-lg text-ink">
							{formatDate(game.gameDate, 'short')}
						</span>
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-sm font-semibold text-ink">
							{formatTime(game.startTime)} · {game.location}
						</span>
					</span>
					{#if index === 0 && game.status === 'scheduled'}
						<span class="badge-ice shrink-0">{t('games.next')}</span>
					{:else}
						<span class="badge shrink-0 {game.status === 'cancelled' ? 'badge-alert' : ''}">
							{t(gameStatus(game.status).labelKey)}
						</span>
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
					class="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-line bg-surface px-4 py-3 text-sm no-underline transition-colors hover:border-ink/25"
				>
					<span class="font-semibold text-ink">{formatDate(game.gameDate, 'year')}</span>
					<span class="text-muted">{formatTime(game.startTime)} · {game.location}</span>
					<span class="badge ml-auto {game.status === 'cancelled' ? 'badge-alert' : ''}">
						{t(gameStatus(game.status).labelKey)}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
