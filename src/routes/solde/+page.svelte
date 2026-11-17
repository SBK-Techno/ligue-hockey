<script lang="ts">
	import { balanceStatusDefinition } from '#config/balance-status.ts';
	import { PAYMENT_METHODS, paymentDefinition } from '#config/payment-methods.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { formatDate, formatMoney, t } from '#lib/shared/i18n/index.ts';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import StatStrip from '#lib/ui/StatStrip.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const canViewAllBalances = $derived(
		data.actor.kind === 'user' && can(data.actor, 'viewAllBalances')
	);
	const isManager = $derived(data.actor.kind === 'user' && can(data.actor, 'viewAdmin'));
	const status = $derived(
		data.balance ? balanceStatusDefinition(data.balance.status) : null
	);

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
		{#if status}
			<span class={badgeClass(status.tone)}>{t(status.labelKey)}</span>
		{/if}
		{#if canViewAllBalances && data.balance}
			<a class="btn-secondary btn-sm" href="/admin/soldes">{t('balance.manageAll')}</a>
		{/if}
	{/snippet}
</PageHeader>

<div class="page-stack">
	{#if !data.balance}
		{#if !data.hasPlayerProfile}
			<EmptyState title={t('balance.adminNoProfile')}>
				{#snippet action()}
					{#if canViewAllBalances}
						<a class="btn-secondary btn-sm" href="/admin/soldes">{t('balance.manageAll')}</a>
					{/if}
				{/snippet}
			</EmptyState>
		{:else}
			<EmptyState title={t('balance.noPlan')} help={t('balance.noPlanHelp')} />
		{/if}
	{:else}
		<StatStrip
			cells={[
				{
					value: formatMoney(data.balance.totalCents, data.balance.currency),
					label: t('balance.total')
				},
				{
					value: formatMoney(data.balance.paidCents, data.balance.currency),
					label: t('balance.paid')
				},
				{
					value: formatMoney(data.balance.outstandingCents, data.balance.currency),
					label: t('balance.outstanding'),
					tone: data.balance.isOverdue ? 'alert' : undefined
				}
			]}
		/>

		{#if data.balance.isOverdue && data.balance.overdueCents > 0}
			<div class="alert">
				{t('balance.overdueNotice', {
					amount: formatMoney(data.balance.overdueCents, data.balance.currency)
				})}
			</div>
		{/if}

		<div class="grid gap-4 lg:grid-cols-12 lg:items-start">
			<div class="min-w-0 lg:col-span-7">
				<SectionCard title={t('balance.installmentsTitle')} flush>
					<ul role="list" class="divide-y divide-line">
						{#each data.balance.installments as installment (installment.number)}
							{@const installmentStatus = balanceStatusDefinition(installment.status)}
							<li class="section-row">
								<div class="flex flex-wrap items-start justify-between gap-3">
									<div class="min-w-0">
										<p class="text-body font-semibold">
											{t('balance.installment', { number: installment.number })}
										</p>
										<p class="mt-0.5 text-meta text-muted">
											<span class="numeric">
												{formatMoney(installment.amountCents, data.balance.currency)}
											</span>
											·
											{#if installment.status === 'paid'}
												{#if installment.paidAt}
													{t('balance.paidOn', { date: formatDate(installment.paidAt, 'year') })}
												{/if}
											{:else if installment.dueDate}
												{t('balance.dueOn', { date: formatDate(installment.dueDate, 'year') })}
											{:else}
												{t('balance.dueDatePending')}
											{/if}
										</p>
										{#if installment.paidCents > 0 && installment.remainingCents > 0}
											<p class="hint">
												{t('balance.paidAmount', {
													amount: formatMoney(installment.paidCents, data.balance.currency)
												})}
												{t('balance.remaining', {
													amount: formatMoney(installment.remainingCents, data.balance.currency)
												})}
											</p>
										{/if}
									</div>
									<span class={badgeClass(installmentStatus.tone)}>
										{t(installmentStatus.labelKey)}
									</span>
								</div>
							</li>
						{/each}
					</ul>
					<div class="section-body border-t border-line">
						<p class="text-body text-muted">{t('balance.payHelp')}</p>
						<p class="hint">{t('balance.paymentMethods', { methods })}</p>
						<p class="hint">{t('balance.onlyYou')}</p>
					</div>
				</SectionCard>
			</div>

			<div class="min-w-0 lg:col-span-5">
				<SectionCard title={t('balance.history')} flush>
					{#if data.payments.length === 0}
						<div class="section-body">
							<EmptyState title={t('balance.noPayments')} />
						</div>
					{:else}
						<ul role="list" class="divide-y divide-line">
							{#each data.payments as payment (payment.id)}
								<li class="section-row">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div>
											<p class="numeric text-body font-semibold">
												{formatMoney(payment.amountCents, data.balance.currency)}
											</p>
											<p class="text-meta text-muted">
												{formatDate(payment.paidAt, 'year')} ·
												{t(paymentDefinition(payment.method).labelKey)}
											</p>
										</div>
										{#if payment.note}
											<span class="hint min-w-0 break-words">{payment.note}</span>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</SectionCard>
			</div>
		</div>
	{/if}
</div>
