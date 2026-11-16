<script lang="ts">
	import { balanceStatusDefinition } from '#config/balance-status.ts';
	import { gameStatus } from '#config/game-status.ts';
	import { positionDefinition } from '#config/positions.ts';
	import { formatCount, formatDate, formatMoney, formatTime, t } from '#lib/shared/i18n/index.ts';
		import PageHeader from '#lib/ui/PageHeader.svelte';
	import RecordRow from '#lib/ui/RecordRow.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import StatStrip from '#lib/ui/StatStrip.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hasTodo = $derived(data.unpaid.length > 0 || data.requests.length > 0);
	const openSlots = $derived(
		data.nextGame?.slots.filter((slot) => !slot.player).length ?? 0
	);
	const pendingNames = $derived(
		data.nextAvailability?.pending.map((entry) => entry.fullName) ?? []
	);
</script>

<PageHeader title={t('admin.dashboard')} meta={t('admin.dashboardHelp')} />

<StatStrip
	cells={[
		...(data.permissions.balances
			? [
					{
						value: data.counts.unpaid,
						label: `${t('admin.toReceive')}${
							data.outstandingCents > 0 && data.currency
								? ` · ${formatMoney(data.outstandingCents, data.currency)}`
								: ''
						}`,
						tone: data.counts.overdue > 0 ? ('alert' as const) : undefined
					}
				]
			: []),
		...(data.permissions.balances
			? [{ value: data.counts.noPlan, label: t('balance.noPlanShort') }]
			: []),
		...(data.permissions.subs
			? [{ value: data.counts.openRequests, label: t('admin.openRequests') }]
			: []),
		...(data.permissions.games
			? [{ value: data.counts.unanswered, label: t('admin.unanswered') }]
			: [])
	]}
/>

<div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
	<div class="space-y-4">
		<SectionCard title={t('admin.todo')}>
			{#if hasTodo}
				<ul role="list" class="divide-y divide-line">
					{#each data.unpaid as balance (balance.playerId)}
						{@const status = balanceStatusDefinition(balance.status)}
						<li>
							<RecordRow
								href="/admin/joueurs/{balance.playerId}#solde"
								title={balance.playerName}
								meta={t('balance.paidOf', {
									paid: formatMoney(balance.paidCents, balance.currency),
									total: formatMoney(balance.totalCents, balance.currency)
								})}
								trailing={formatMoney(balance.outstandingCents, balance.currency)}
								badge={t(status.labelKey)}
								badgeTone={status.tone}
							/>
						</li>
					{/each}

					{#each data.requests as request (request.id)}
						<li>
							<RecordRow
								href="/remplacants"
								title={t('admin.requestRow', {
									position: t(positionDefinition(request.position).labelKey)
								})}
								meta="{formatDate(request.game.gameDate, 'short')} · {request.game.location}{request.requestedByName
									? ` · ${request.requestedByName}`
									: ''}"
								badge={t('subs.placeOpen')}
								badgeTone="ice"
							/>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="px-4 py-3 text-sm text-muted">
					{data.withoutPlan.length > 0 ? t('admin.noUnpaid') : t('admin.nothingTodo')}
				</p>
			{/if}
		</SectionCard>

		{#if data.permissions.balances && data.withoutPlan.length > 0}
			<SectionCard
				title={t('admin.withoutPlanTitle', { count: data.withoutPlan.length })}
				href="/admin/soldes"
				linkLabel={t('admin.balances')}
			>
				<ul role="list" class="divide-y divide-line">
					{#each data.withoutPlan.slice(0, 3) as balance (balance.playerId)}
						<li>
							<RecordRow
								href="/admin/joueurs/{balance.playerId}#solde"
								title={balance.playerName}
							/>
						</li>
					{/each}
				</ul>
			</SectionCard>
		{/if}
	</div>

	<div class="space-y-4">
		{#if data.permissions.games}
			<SectionCard title={t('home.nextGame')}>
				{#if data.nextGame}
					<div class="p-4">
						<p class="serial">{formatDate(data.nextGame.gameDate)}</p>
						<p class="mt-1 font-display text-xl font-semibold leading-tight">
							{formatTime(data.nextGame.startTime)} · {data.nextGame.location}
						</p>
						<div class="mt-3 flex flex-wrap gap-1.5">
							<span class={data.nextGame.generated ? 'badge-ok' : 'badge'}>
								{data.nextGame.generated ? t('games.generated') : t('games.notGenerated')}
							</span>
							{#if openSlots > 0}
								<span class="badge-ice">
									{formatCount(openSlots, 'games.openSlots.one', 'games.openSlots.many')}
								</span>
							{/if}
						</div>
						{#if data.nextAvailability}
							<p class="mt-3 font-mono text-xs text-muted">{data.nextAvailability.summary}</p>
							{#if pendingNames.length > 0}
								<p class="mt-1 text-xs leading-snug text-muted">
									{t('admin.unansweredNames', { names: pendingNames.slice(0, 5).join(', ') })}
								</p>
							{/if}
						{/if}
						<a class="btn-primary mt-4 w-full" href="/admin/matchs/{data.nextGame.id}">
							{t('admin.openSheet')}
						</a>
					</div>
				{:else}
					<div class="p-4">
						<p class="text-sm text-muted">{t('home.noGame')}</p>
						<a class="btn-secondary btn-sm mt-3" href="/admin/matchs">{t('games.adminCreate')}</a>
					</div>
				{/if}
			</SectionCard>
		{/if}

		{#if data.upcoming.length > 0}
			<SectionCard title={t('home.upcoming')} href="/admin/matchs" linkLabel={t('home.allGames')}>
				<ul role="list" class="divide-y divide-line">
					{#each data.upcoming as game (game.id)}
						<li>
							<RecordRow
								href="/admin/matchs/{game.id}"
								title="{formatTime(game.startTime)} · {game.location}"
								meta={formatDate(game.gameDate, 'short')}
								badge={t(gameStatus(game.status).labelKey)}
							/>
						</li>
					{/each}
				</ul>
			</SectionCard>
		{/if}
	</div>
</div>
