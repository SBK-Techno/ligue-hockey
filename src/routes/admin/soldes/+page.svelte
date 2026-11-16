<script lang="ts">
	import { formatMoney, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mb-4">
	<h2>{t('admin.balances')}</h2>
</div>

<div class="mb-4 grid gap-3 sm:grid-cols-4">
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
	<div class="card text-sm text-muted">{t('admin.noPlayers')}</div>
{:else}
	<div class="card-flush overflow-x-auto">
		<table class="table">
			<thead>
				<tr>
					<th>{t('common.player')}</th>
					<th>{t('balance.total')}</th>
					<th>{t('balance.paid')}</th>
					<th>{t('balance.outstanding')}</th>
					<th>{t('balance.title')}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.balances as row (row.playerId)}
					<tr>
						<td>
							<a class="font-semibold text-ink" href="/admin/joueurs/{row.playerId}">{row.playerName}</a>
							{#if !row.active}
								<span class="badge-alert ml-2">{t('admin.status.inactive')}</span>
							{/if}
						</td>
						<td>{formatMoney(row.totalCents, row.currency)}</td>
						<td>{formatMoney(row.paidCents, row.currency)}</td>
						<td class:font-semibold={row.outstandingCents > 0}>
							{formatMoney(row.outstandingCents, row.currency)}
						</td>
						<td>
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
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
