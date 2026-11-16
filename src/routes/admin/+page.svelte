<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import { positionDefinition } from '#config/positions.ts';
	import { formatDate, formatMoney, formatTime, t } from '#lib/shared/i18n/index.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const overdue = $derived(data.balances.filter((balance) => balance.isOverdue));
	const hasTodo = $derived(
		overdue.length > 0 || data.requests.length > 0 || data.counts.overdue > 0
	);
</script>

<PageHeader title={t('admin.dashboard')} meta={t('admin.dashboardHelp')} />

<div class="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-sheet border border-line bg-line lg:grid-cols-4">
	{#if data.permissions.players}
		<a class="bg-surface px-4 py-3 no-underline transition-colors hover:bg-ice-soft" href="/admin/joueurs">
			<p class="numeric text-2xl">{data.counts.active}</p>
			<p class="mt-0.5 text-xs text-muted">{t('admin.totalPlayers')}</p>
		</a>
		<a class="bg-surface px-4 py-3 no-underline transition-colors hover:bg-ice-soft" href="/admin/joueurs">
			<p class="numeric text-2xl">{data.counts.subs}</p>
			<p class="mt-0.5 text-xs text-muted">{t('admin.totalSubs')}</p>
		</a>
	{/if}
	{#if data.permissions.subs}
		<a class="bg-surface px-4 py-3 no-underline transition-colors hover:bg-ice-soft" href="/admin/matchs">
			<p class="numeric text-2xl">{data.counts.openRequests}</p>
			<p class="mt-0.5 text-xs text-muted">{t('admin.openRequests')}</p>
		</a>
	{/if}
	{#if data.permissions.balances}
		<a class="bg-surface px-4 py-3 no-underline transition-colors hover:bg-ice-soft" href="/admin/soldes">
			<p class="numeric text-2xl {data.counts.overdue > 0 ? 'text-alert' : ''}">
				{data.counts.overdue}
			</p>
			<p class="mt-0.5 text-xs text-muted">{t('admin.overdueBalances')}</p>
		</a>
	{/if}
</div>

<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
	<section class="card-flush overflow-hidden" aria-labelledby="todo-titre">
		<div class="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
			<h2 id="todo-titre" class="text-lg">{t('admin.todo')}</h2>
			<span class="micro-label">{t('admin.thisWeek')}</span>
		</div>

		{#if hasTodo}
			<ul role="list" class="divide-y divide-line/70">
				{#if data.permissions.balances}
					{#each overdue as balance (balance.playerId)}
						<li>
							<a
								class="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-ink/[0.03]"
								href="/admin/joueurs/{balance.playerId}"
							>
								<span class="min-w-0">
									<span class="block truncate text-sm font-semibold">{balance.playerName}</span>
									<span class="mt-0.5 block text-xs text-muted">{t('admin.overdueBalance')}</span>
								</span>
								<span class="shrink-0 text-right">
									<span class="numeric block text-base text-alert">
										{formatMoney(balance.outstandingCents, balance.currency)}
									</span>
									<span class="mt-0.5 block text-[11px] text-alert">
										{t('balance.status.overdue')}
									</span>
								</span>
							</a>
						</li>
					{/each}
				{/if}

				{#each data.requests.slice(0, 6) as request (request.id)}
					<li>
						<a
							class="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-ink/[0.03]"
							href="/matchs/{request.gameId}"
						>
							<span class="min-w-0">
								<span class="block text-sm font-semibold">
									{t('admin.requestRow', {
										position: t(positionDefinition(request.position).labelKey)
									})}
								</span>
								<span class="mt-0.5 block text-xs text-muted">
									{formatDate(request.game.gameDate, 'short')} · {request.game.location}
								</span>
							</span>
							<span class="badge-ice shrink-0">{t('subs.placeOpen')}</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="px-4 py-6">
				<p class="text-sm text-muted">{t('admin.nothingTodo')}</p>
			</div>
		{/if}

		{#if data.requests.length > 6}
			<div class="border-t border-line/70 px-4 py-2">
				<a class="link text-sm" href="/admin/matchs">
					{t('admin.moreRequests', { count: data.requests.length - 6 })}
				</a>
			</div>
		{/if}
	</section>

	{#if data.permissions.games}
		<section class="card" aria-labelledby="prochain-titre">
			<h2 id="prochain-titre" class="text-lg">{t('admin.nextGame')}</h2>
			{#if data.nextGame}
				<a
					class="mt-3 block rounded-control border border-line bg-paper px-3 py-3 no-underline transition-colors hover:bg-ice-soft"
					href="/admin/matchs/{data.nextGame.id}"
				>
					<p class="font-display text-xl leading-tight">{formatDate(data.nextGame.gameDate)}</p>
					<p class="mt-1 text-sm text-muted">
						{formatTime(data.nextGame.startTime)} · {data.nextGame.location}
					</p>
					<p class="mt-3">
						<span class={data.nextGame.generated ? 'badge-ok' : 'badge'}>
							{data.nextGame.generated ? t('games.generated') : t('games.notGenerated')}
						</span>
					</p>
				</a>
			{:else}
				<p class="mt-3 text-sm text-muted">{t('home.noGame')}</p>
				<a class="btn-secondary btn-sm mt-3" href="/admin/matchs">{t('games.adminCreate')}</a>
			{/if}
		</section>
	{/if}
</div>

{#if data.upcoming.length > 0}
	<section class="card-flush mt-4 overflow-hidden" aria-labelledby="prochaines-titre">
		<div class="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
			<h2 id="prochaines-titre" class="text-lg">{t('home.upcoming')}</h2>
			<a class="link text-sm" href="/admin/matchs">{t('home.allGames')}</a>
		</div>
		<ul role="list" class="divide-y divide-line/70">
			{#each data.upcoming as game (game.id)}
				<li>
					<a
						class="flex min-h-12 items-center gap-3 px-4 py-2 no-underline transition-colors hover:bg-ink/[0.03]"
						href="/admin/matchs/{game.id}"
					>
						<span class="w-16 shrink-0 whitespace-nowrap font-mono text-xs text-muted">
							{formatDate(game.gameDate, 'short')}
						</span>
						<span class="min-w-0 flex-1 truncate text-sm font-semibold">
							{formatTime(game.startTime)} · {game.location}
						</span>
						<span class="badge shrink-0">{t(gameStatus(game.status).labelKey)}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
