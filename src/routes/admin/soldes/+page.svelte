<script lang="ts">
	import { balanceStatusDefinition } from '#config/balance-status.ts';
	import { formatMoney, t } from '#lib/shared/i18n/index.ts';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Filter = 'all' | 'overdue' | 'outstanding' | 'noPlan';
	let filter = $state<Filter>('all');

	const filters = [
		{ key: 'all' as const, labelKey: 'admin.filterAll' as const },
		{ key: 'overdue' as const, labelKey: 'balance.status.overdue' as const },
		{ key: 'outstanding' as const, labelKey: 'balance.outstanding' as const },
		{ key: 'noPlan' as const, labelKey: 'balance.noPlanShort' as const }
	];

	const rows = $derived(
		data.balances
			.filter((row) => {
				if (filter === 'overdue') return row.status === 'overdue';
				if (filter === 'outstanding') return row.outstandingCents > 0;
				if (filter === 'noPlan') return !row.hasPlan;
				return true;
			})
			.sort(
				(a, b) =>
					Number(b.status === 'overdue') - Number(a.status === 'overdue') ||
					b.outstandingCents - a.outstandingCents
			)
	);
</script>

<PageHeader title={t('admin.balances')} meta={t('admin.balancesHelp')} />

<div class="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-sheet border border-line bg-line lg:grid-cols-4">
	<div class="bg-surface px-4 py-3">
		<p class="numeric text-xl">{formatMoney(data.totals.total ?? 0, data.currency)}</p>
		<p class="mt-0.5 text-xs text-muted">{t('balance.total')}</p>
	</div>
	<div class="bg-surface px-4 py-3">
		<p class="numeric text-xl">{formatMoney(data.totals.paid ?? 0, data.currency)}</p>
		<p class="mt-0.5 text-xs text-muted">{t('balance.paid')}</p>
	</div>
	<div class="bg-surface px-4 py-3">
		<p class="numeric text-xl">{formatMoney(data.totals.outstanding ?? 0, data.currency)}</p>
		<p class="mt-0.5 text-xs text-muted">{t('balance.outstanding')}</p>
	</div>
	<div class="bg-surface px-4 py-3">
		<p class="numeric text-xl {(data.totals.overdue ?? 0) > 0 ? 'text-alert' : ''}">
			{data.totals.overdue ?? 0}
		</p>
		<p class="mt-0.5 text-xs text-muted">{t('admin.overdueBalances')}</p>
	</div>
</div>

{#if data.balances.length > 0}
	<div class="mb-3 flex flex-wrap items-center gap-1">
		{#each filters as option (option.key)}
			<button
				type="button"
				class="min-h-11 rounded-control border px-2.5 text-[13px] font-medium transition-colors {filter ===
				option.key
					? 'border-ice bg-ice text-on-brand'
					: 'border-line-strong bg-surface text-muted hover:bg-paper'}"
				aria-pressed={filter === option.key}
				onclick={() => (filter = option.key)}
			>
				{t(option.labelKey)}
			</button>
		{/each}
	</div>
{/if}

{#if data.balances.length === 0}
	<div class="card">
		<p class="text-sm text-muted">{t('admin.noPlayers')}</p>
	</div>
{:else if rows.length === 0}
	<div class="card">
		<p class="text-sm text-muted">{t('admin.noResults')}</p>
	</div>
{:else}
	<div class="card-flush overflow-hidden">
		<ul role="list" class="divide-y divide-line/70">
			{#each rows as row (row.playerId)}
				<li>
					<a
						class="flex min-h-14 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-ink/[0.03]"
						href="/admin/joueurs/{row.playerId}"
					>
						<span class="min-w-0 flex-1">
							<span class="flex min-w-0 items-center gap-2">
								<span class="truncate font-semibold text-ink">{row.playerName}</span>
								{#if !row.active}
									<span class="badge shrink-0">{t('admin.status.inactive')}</span>
								{/if}
							</span>
							<span class="mt-0.5 block truncate text-xs text-muted">
								{#if row.hasPlan}
									{t('balance.paidOf', {
										paid: formatMoney(row.paidCents, row.currency),
										total: formatMoney(row.totalCents, row.currency)
									})}
								{:else}
									{t('balance.noPlanShort')}
								{/if}
							</span>
						</span>
						<span class="shrink-0 text-right">
							<span class="numeric block text-base {row.isOverdue ? 'text-alert' : 'text-ink'}">
								{formatMoney(row.outstandingCents, row.currency)}
							</span>
							<span class="mt-0.5 block">
								{#if !row.hasPlan}
									<span class="badge">{t('balance.noPlanShort')}</span>
								{:else}
									{@const status = balanceStatusDefinition(row.status)}
									<span class={badgeClass(status.tone)}>{t(status.labelKey)}</span>
								{/if}
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
