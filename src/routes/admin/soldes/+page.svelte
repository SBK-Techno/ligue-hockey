<script lang="ts">
	import { balanceStatusDefinition } from '#config/balance-status.ts';
	import { formatCount, formatMoney, t } from '#lib/shared/i18n/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FilterChips from '#lib/ui/FilterChips.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import RecordRow from '#lib/ui/RecordRow.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import StatStrip from '#lib/ui/StatStrip.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Filter = 'all' | 'overdue' | 'outstanding' | 'noPlan';
	// La page s'ouvre sur l'exception : les joueurs qui doivent encore payer.
	let filter = $state<Filter>('outstanding');

	const filters = [
		{ key: 'all' as const, labelKey: 'admin.filterAll' as const },
		{ key: 'overdue' as const, labelKey: 'balance.status.overdue' as const },
		{ key: 'outstanding' as const, labelKey: 'balance.outstanding' as const },
		{ key: 'noPlan' as const, labelKey: 'balance.noPlanShort' as const }
	];

	const counts = $derived({
		all: data.balances.length,
		overdue: data.balances.filter((row) => row.status === 'overdue').length,
		outstanding: data.balances.filter((row) => row.outstandingCents > 0).length,
		noPlan: data.balances.filter((row) => !row.hasPlan).length
	});

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

<div class="page-stack">
	<StatStrip
		cells={[
			{ value: formatMoney(data.totals.total ?? 0, data.currency), label: t('balance.total') },
			{ value: formatMoney(data.totals.paid ?? 0, data.currency), label: t('balance.paid') },
			{
				value: formatMoney(data.totals.outstanding ?? 0, data.currency),
				label: t('balance.outstanding')
			},
			{
				value: data.totals.overdue ?? 0,
				label: t('admin.overdueBalances'),
				tone: (data.totals.overdue ?? 0) > 0 ? ('alert' as const) : undefined
			}
		]}
	/>

	{#if data.balances.length > 0}
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
			<FilterChips
				items={filters.map((option) => ({
					key: option.key,
					label: t(option.labelKey),
					count: counts[option.key]
				}))}
				active={filter}
				label={t('admin.filter')}
				onselect={(key) => (filter = key as Filter)}
			/>
			<p class="text-meta text-muted sm:ml-auto" aria-live="polite">
				{formatCount(rows.length, 'common.playerCount.one', 'common.playerCount.many')}
			</p>
		</div>
	{/if}

	{#if data.balances.length === 0}
		<EmptyState title={t('admin.noPlayers')} />
	{:else if rows.length === 0}
		{#if filter === 'outstanding'}
			<EmptyState title={t('admin.allBalancesPaid')}>
				{#snippet action()}
					<button class="btn-secondary" type="button" onclick={() => (filter = 'all')}>
						{t('admin.filterAll')}
					</button>
				{/snippet}
			</EmptyState>
		{:else if filter === 'overdue'}
			<EmptyState title={t('admin.noOverdue')}>
				{#snippet action()}
					<button class="btn-secondary" type="button" onclick={() => (filter = 'outstanding')}>
						{t('balance.outstanding')}
					</button>
				{/snippet}
			</EmptyState>
		{:else}
			<EmptyState title={t('admin.noResults')}>
				{#snippet action()}
					<button class="btn-secondary" type="button" onclick={() => (filter = 'all')}>
						{t('admin.filterAll')}
					</button>
				{/snippet}
			</EmptyState>
		{/if}
	{:else}
		<SectionCard flush>
			<ul role="list" class="ledger-columns">
				{#each rows as row (row.playerId)}
					{@const status = balanceStatusDefinition(row.status)}
					<li>
						<RecordRow
							href="/admin/joueurs/{row.playerId}#solde"
							title={row.playerName}
							meta={[
								!row.active ? t('admin.inactive') : null,
								row.hasPlan
									? t('balance.paidOf', {
											paid: formatMoney(row.paidCents, row.currency),
											total: formatMoney(row.totalCents, row.currency)
										})
									: null
							]
								.filter(Boolean)
								.join(' · ')}
							trailing={formatMoney(row.outstandingCents, row.currency)}
							badge={row.hasPlan ? t(status.labelKey) : t('balance.noPlanShort')}
							badgeTone={row.hasPlan ? status.tone : 'neutral'}
						/>
					</li>
				{/each}
			</ul>
		</SectionCard>
	{/if}
</div>
