<script lang="ts">
	import { paymentDefinition } from '#config/payment-methods.ts';
	import { formatDate, formatMoney, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const statusKey = {
		paid: 'balance.status.paid',
		partial: 'balance.status.partial',
		overdue: 'balance.status.overdue',
		upcoming: 'balance.status.upcoming'
	} as const;
</script>

<div class="mb-5">
	<h1>{t('balance.title')}</h1>
	<p class="mt-1 text-sm text-muted">{t('balance.subtitle')}</p>
</div>

{#if !data.balance}
	<div class="card text-sm text-muted">{t('balance.noPlan')}</div>
{:else}
	<div class="mb-4 grid gap-3 sm:grid-cols-3">
		<div class="stat">
			<p class="stat-value">{formatMoney(data.balance.totalCents, data.balance.currency)}</p>
			<p class="stat-label">{t('balance.total')}</p>
		</div>
		<div class="stat">
			<p class="stat-value">{formatMoney(data.balance.paidCents, data.balance.currency)}</p>
			<p class="stat-label">{t('balance.paid')}</p>
		</div>
		<div class="stat">
			<p class="stat-value {data.balance.isOverdue ? 'text-alert' : ''}">
				{formatMoney(data.balance.outstandingCents, data.balance.currency)}
			</p>
			<p class="stat-label">{t('balance.outstanding')}</p>
		</div>
	</div>

	{#if data.balance.isOverdue && data.balance.overdueCents > 0}
		<div class="alert mb-4">
			{t('balance.overdueNotice', {
				amount: formatMoney(data.balance.overdueCents, data.balance.currency)
			})}
		</div>
	{/if}

	<section class="card mb-4">
		<h2 class="mb-3">{t('balance.installmentsTitle')}</h2>
		<ul class="space-y-2">
			{#each data.balance.installments as installment (installment.number)}
				<li class="rounded-xl border border-line bg-paper px-4 py-3">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p class="font-semibold">{t('balance.installment', { number: installment.number })}</p>
							<p class="text-sm text-muted">
								{formatMoney(installment.amountCents, data.balance.currency)}
								{#if installment.dueDate}
									· {t('balance.dueOn', { date: formatDate(installment.dueDate, 'year') })}
								{/if}
							</p>
						</div>
						<span
							class="badge {installment.status === 'overdue'
								? 'badge-alert'
								: installment.status === 'paid'
									? 'badge-ok'
									: installment.status === 'partial'
										? 'badge-ice'
										: ''}"
						>
							{t(statusKey[installment.status])}
						</span>
					</div>
					{#if installment.paidCents > 0 && installment.remainingCents > 0}
						<p class="hint">
							{formatMoney(installment.paidCents, data.balance.currency)} {t('balance.paid').toLowerCase()}
							· {formatMoney(installment.remainingCents, data.balance.currency)} {t('balance.outstanding').toLowerCase()}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
		<p class="hint mt-3">{t('balance.onlyYou')}</p>
	</section>

	<section class="card">
		<h2 class="mb-3">{t('balance.history')}</h2>
		{#if data.payments.length === 0}
			<p class="text-sm text-muted">{t('balance.noPayments')}</p>
		{:else}
			<ul class="divide-y divide-line/70">
				{#each data.payments as payment (payment.id)}
					<li class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
						<div>
							<p class="font-semibold">{formatMoney(payment.amountCents, data.balance.currency)}</p>
							<p class="text-xs text-muted">
								{formatDate(payment.paidAt, 'year')} · {t(paymentDefinition(payment.method).labelKey)}
							</p>
						</div>
						{#if payment.note}
							<span class="hint">{payment.note}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
