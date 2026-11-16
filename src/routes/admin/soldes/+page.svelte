<script lang="ts">
	import { formatMoney, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mb-5">
	<h1>{t('admin.balances')}</h1>
	<p class="mt-1.5 text-sm text-muted">{t('admin.balancesHelp')}</p>
</div>

<div class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
	<div class="stat">
		<p class="stat-value">{formatMoney(data.totals.total ?? 0, data.currency)}</p>
		<p class="stat-label">{t('balance.total')}</p>
	</div>
	<div class="stat">
		<p class="stat-value">{formatMoney(data.totals.paid ?? 0, data.currency)}</p>
		<p class="stat-label">{t('balance.paid')}</p>
	</div>
	<div class="stat">
		<p class="stat-value">{formatMoney(data.totals.outstanding ?? 0, data.currency)}</p>
		<p class="stat-label">{t('balance.outstanding')}</p>
	</div>
	<div class="stat">
		<p class="stat-value text-alert">{data.totals.overdue ?? 0}</p>
		<p class="stat-label">{t('admin.overdueBalances')}</p>
	</div>
</div>

{#if data.balances.length === 0}
	<div class="card">
		<p class="text-sm text-muted">{t('admin.noPlayers')}</p>
	</div>
{:else}
	<ul role="list" class="space-y-2">
		{#each data.balances as row (row.playerId)}
			<li class="card flex flex-wrap items-center justify-between gap-3 py-3.5">
				<div class="min-w-0">
					<a class="font-semibold text-ink no-underline hover:underline" href="/admin/joueurs/{row.playerId}">
						{row.playerName}
					</a>
					{#if !row.active}
						<span class="badge-alert ml-2">{t('admin.status.inactive')}</span>
					{/if}
					{#if row.hasPlan}
						<p class="mt-0.5 text-xs text-muted">
							{t('balance.paidOf', {
								paid: formatMoney(row.paidCents, row.currency),
								total: formatMoney(row.totalCents, row.currency)
							})}
						</p>
					{/if}
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<div class="text-right">
						<p class="font-display text-lg font-bold text-ink">
							{formatMoney(row.outstandingCents, row.currency)}
						</p>
						{#if !row.hasPlan}
							<span class="badge">{t('balance.noPlanShort')}</span>
						{:else if row.isOverdue}
							<span class="badge-alert">{t('balance.status.overdue')}</span>
						{:else if row.outstandingCents === 0}
							<span class="badge-ok">{t('balance.status.paid')}</span>
						{:else if row.installments.some((installment) => installment.status === 'partial')}
							<span class="badge-ice">{t('balance.status.partial')}</span>
						{:else}
							<span class="badge">{t('balance.status.upcoming')}</span>
						{/if}
					</div>
					<a class="btn-secondary btn-sm" href="/admin/joueurs/{row.playerId}">
						{t('admin.openPlayer')}
					</a>
				</div>
			</li>
		{/each}
	</ul>
{/if}
