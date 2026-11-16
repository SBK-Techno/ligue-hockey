<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

</script>

<PageHeader title={t('admin.dashboard')} meta={t('admin.dashboardHelp')} />

<div class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
	{#if data.permissions.players}
		<a class="stat card-link" href="/admin/joueurs">
			<p class="stat-value">{data.counts.active}</p>
			<p class="stat-label">{t('admin.totalPlayers')}</p>
		</a>
		<a class="stat card-link" href="/admin/joueurs">
			<p class="stat-value">{data.counts.subs}</p>
			<p class="stat-label">{t('admin.totalSubs')}</p>
		</a>
	{/if}
	{#if data.permissions.subs}
		<a class="stat card-link" href="/admin/matchs">
			<p class="stat-value">{data.counts.openRequests}</p>
			<p class="stat-label">{t('admin.openRequests')}</p>
		</a>
	{/if}
	{#if data.permissions.balances}
		<a class="stat card-link" href="/admin/soldes">
			<p class="stat-value {data.counts.overdue > 0 ? 'text-alert' : ''}">
				{data.counts.overdue}
			</p>
			<p class="stat-label">{t('admin.overdueBalances')}</p>
		</a>
	{/if}
</div>

<div class="grid gap-4 sm:grid-cols-2">
	{#if data.permissions.games}
		<section class="card">
			<div class="section-title">
				<h2>{t('admin.nextGame')}</h2>
				<a class="link text-sm" href="/admin/matchs">{t('common.seeAll')}</a>
			</div>
			{#if data.nextGame}
				<a
					class="mt-3 block rounded-control bg-paper px-3 py-3 no-underline hover:bg-ice-soft"
					href="/admin/matchs/{data.nextGame.id}"
				>
					<p class="font-semibold text-ink">{formatDate(data.nextGame.gameDate)}</p>
					<p class="mt-0.5 text-sm text-muted">
						{formatTime(data.nextGame.startTime)} · {data.nextGame.location}
					</p>
				</a>
			{:else}
				<p class="mt-3 text-sm text-muted">{t('home.noGame')}</p>
				<a class="btn-secondary btn-sm mt-3" href="/admin/matchs">{t('games.adminCreate')}</a>
			{/if}
		</section>
	{/if}

	{#if data.permissions.subs}
		<section class="card">
			<div class="section-title">
				<h2>{t('admin.openRequests')}</h2>
				<a class="link text-sm" href="/admin/matchs">{t('common.seeAll')}</a>
			</div>
			{#if data.requests.length === 0}
				<p class="mt-3 text-sm text-muted">{t('subs.noneOpen')}</p>
			{:else}
				<ul role="list" class="mt-3 space-y-1.5 text-sm">
					{#each data.requests.slice(0, 4) as request (request.id)}
						<li>
							<a
								class="flex items-center justify-between gap-3 rounded-control bg-paper px-3 py-2.5 no-underline hover:bg-ice-soft"
								href="/matchs/{request.gameId}"
							>
								<span class="min-w-0">
									<span class="block font-semibold text-ink">
										{t(positionDefinition(request.position).labelKey)}
									</span>
									<span class="block text-xs text-muted">
										{formatDate(request.game.gameDate, 'short')} · {request.game.location}
									</span>
								</span>
								<span class="badge-ice shrink-0">{t('subs.placeOpen')}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>
