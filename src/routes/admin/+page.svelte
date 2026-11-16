<script lang="ts">
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
	<div class="stat">
		<p class="stat-value">{data.counts.active}</p>
		<p class="stat-label">{t('admin.totalPlayers')}</p>
	</div>
	<div class="stat">
		<p class="stat-value">{data.counts.subs}</p>
		<p class="stat-label">{t('admin.totalSubs')}</p>
	</div>
	<div class="stat">
		<p class="stat-value {data.counts.openRequests > 0 ? 'text-alert' : ''}">
			{data.counts.openRequests}
		</p>
		<p class="stat-label">{t('admin.openRequests')}</p>
	</div>
	<div class="stat">
		<p class="stat-value {data.counts.overdue > 0 ? 'text-alert' : ''}">{data.counts.overdue}</p>
		<p class="stat-label">{t('admin.overdueBalances')}</p>
	</div>
</div>

<div class="grid gap-4 sm:grid-cols-2">
	<section class="card">
		<div class="section-title">
			<h2>{t('admin.nextGame')}</h2>
			<a href="/admin/matchs">{t('common.seeAll')}</a>
		</div>
		{#if data.nextGame}
			<a href="/admin/matchs/{data.nextGame.id}" class="mt-3 block no-underline">
				<p class="font-semibold text-ink">{formatDate(data.nextGame.gameDate)}</p>
				<p class="text-sm text-muted">
					{formatTime(data.nextGame.startTime)} · {data.nextGame.location}
				</p>
			</a>
		{:else}
			<p class="mt-3 text-sm text-muted">{t('home.noGame')}</p>
		{/if}
	</section>

	<section class="card">
		<div class="section-title">
			<h2>{t('admin.openRequests')}</h2>
			<a href="/remplacants">{t('common.seeAll')}</a>
		</div>
		{#if data.requests.length === 0}
			<p class="mt-3 text-sm text-muted">{t('subs.noneOpen')}</p>
		{:else}
			<ul class="mt-3 space-y-2 text-sm">
				{#each data.requests.slice(0, 4) as request (request.id)}
					<li class="flex items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2">
						<span>{formatDate(request.game.gameDate, 'short')}</span>
						<span class="badge-ice">{request.game.location}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
