<script lang="ts">
	import type { I18nKey } from '#config/i18n/fr.ts';
	import { PAYMENT_METHODS, paymentDefinition } from '#config/payment-methods.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { formatDate, formatMoney, t } from '#lib/shared/i18n/index.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const canViewAllBalances = $derived(
		data.actor.kind === 'user' && can(data.actor, 'viewAllBalances')
	);
	const isManager = $derived(data.actor.kind === 'user' && can(data.actor, 'viewAdmin'));

	const statusKey: Record<string, I18nKey> = {
		paid: 'balance.status.paid',
		partial: 'balance.status.partial',
		overdue: 'balance.status.overdue',
		upcoming: 'balance.status.upcoming'
	};

	const methods = $derived(
		PAYMENT_METHODS.filter((method) => method.key !== 'other')
			.map((method) => t(method.labelKey))
			.join(', ')
	);
</script>

<PageHeader
	title={t('balance.title')}
	meta="{data.seasonLabel} · {isManager && !data.hasPlayerProfile
		? t('balance.subtitleAdmin')
		: t('balance.subtitle')}"
>
	{#snippet actions()}
		{#if canViewAllBalances && data.balance}
			<a class="btn-secondary btn-sm" href="/admin/soldes">{t('balance.manageAll')}</a>
		{/if}
	{/snippet}
</PageHeader>

{#if !data.balance}
	<div class="card">
		{#if !data.hasPlayerProfile}
			<p class="text-sm text-muted">{t('balance.adminNoProfile')}</p>
			{#if canViewAllBalances}
				<a class="btn-secondary btn-sm mt-3" href="/admin/soldes">
					{t('balance.manageAll')}
				</a>
			{/if}
		{:else}
			<p class="text-sm text-muted">{t('balance.noPlan')}</p>
			<p class="hint">{t('balance.noPlanHelp')}</p>
		{/if}
	</div>
{:else}
	<div class="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-sheet border border-line bg-line">
		<div class="bg-surface px-3 py-3 sm:px-4">
			<p class="numeric text-xl">{formatMoney(data.balance.totalCents, data.balance.currency)}</p>
			<p class="mt-0.5 text-xs text-muted">{t('balance.total')}</p>
		</div>
		<div class="bg-surface px-3 py-3 sm:px-4">
			<p class="numeric text-xl">{formatMoney(data.balance.paidCents, data.balance.currency)}</p>
			<p class="mt-0.5 text-xs text-muted">{t('balance.paid')}</p>
		</div>
		<div class="bg-surface px-3 py-3 sm:px-4">
			<p class="numeric text-xl {data.balance.isOverdue ? 'text-alert' : ''}">
				{formatMoney(data.balance.outstandingCents, data.balance.currency)}
			</p>
			<p class="mt-0.5 text-xs text-muted">{t('balance.outstanding')}</p>
		</div>
	</div>

	{#if data.balance.isOverdue && data.balance.overdueCents > 0}
		<div class="alert mb-4">
			{t('balance.overdueNotice', {
				amount: formatMoney(data.balance.overdueCents, data.balance.currency)
			})}
		</div>
	{/if}

	<section class="card-flush mb-4 overflow-hidden">
		<h2 class="border-b border-line/70 px-4 py-3 text-lg">{t('balance.installmentsTitle')}</h2>
		<ul role="list" class="divide-y divide-line/70">
			{#each data.balance.installments as installment (installment.number)}
				<li class="px-4 py-3">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p class="font-semibold">{t('balance.installment', { number: installment.number })}</p>
							<p class="text-sm text-muted">
								{formatMoney(installment.amountCents, data.balance.currency)}
								·
								{#if installment.dueDate}
									{t('balance.dueOn', { date: formatDate(installment.dueDate, 'year') })}
								{:else}
									{t('balance.dueDatePending')}
								{/if}
							</p>
						</div>
						<span
							class={installment.status === 'overdue'
								? 'badge-alert'
								: installment.status === 'paid'
									? 'badge-ok'
									: installment.status === 'partial'
										? 'badge-ice'
										: 'badge'}
						>
							{t(statusKey[installment.status])}
						</span>
					</div>
					{#if installment.paidCents > 0 && installment.remainingCents > 0}
						<p class="hint">
							{t('balance.paidOf', {
								paid: formatMoney(installment.paidCents, data.balance.currency),
								total: formatMoney(installment.amountCents, data.balance.currency)
							})}
							{t('balance.remaining', {
								amount: formatMoney(installment.remainingCents, data.balance.currency)
							})}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
		<div class="border-t border-line/70 px-4 py-3">
			<p class="text-sm text-muted">{t('balance.payHelp')}</p>
			<p class="hint">{t('balance.paymentMethods', { methods })}</p>
			<p class="hint">{t('balance.onlyYou')}</p>
		</div>
	</section>

	<section class="card-flush overflow-hidden">
		<h2 class="border-b border-line/70 px-4 py-3 text-lg">{t('balance.history')}</h2>
		{#if data.payments.length === 0}
			<p class="px-4 py-3 text-sm text-muted">{t('balance.noPayments')}</p>
		{:else}
			<ul role="list" class="divide-y divide-line/70">
				{#each data.payments as payment (payment.id)}
					<li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
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
