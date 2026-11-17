<script lang="ts">
	import { balanceStatusDefinition } from '#config/balance-status.ts';
	import { MONEY_INPUT } from '#config/money.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { PAYMENT_METHODS, paymentDefinition } from '#config/payment-methods.ts';
	import { PLAYER_LIMITS } from '#config/players.ts';
	import { capabilityDefinition } from '#config/capabilities.ts';
	import { ROLES, roleDefinition, type Role } from '#config/roles.ts';
	import { POSITIONS, positionDefinition, type Position } from '#config/positions.ts';
	import { FINANCE_LIMITS } from '#config/finance.ts';
	import {
		currencySymbol,
		formatAge,
		formatCount,
		formatDate,
		formatDecimal,
		formatMoney,
		formatTimestamp,
		t
	} from '#lib/shared/i18n/index.ts';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import Avatar from '#lib/ui/Avatar.svelte';
	import AvatarPicker from '#lib/ui/AvatarPicker.svelte';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import StatStrip from '#lib/ui/StatStrip.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const player = $derived(data.player);
	let selectedRole = $state<Role | null>(null);
	// Le poste pilote la liste de légendes offerte, sans attendre l’enregistrement.
	// svelte-ignore state_referenced_locally
	let position = $state<Position | null>(player?.position ?? null);
	const activeRole = $derived(selectedRole ?? player?.role ?? 'player');
	const selectedRoleDefinition = $derived(roleDefinition(activeRole));
	const isSelf = $derived(
		data.actor.kind === 'user' && player?.userId === data.actor.userId
	);
	const symbol = $derived(currencySymbol(data.currency));
	const headerMeta = $derived(
		player
			? [
					player.email,
					t(positionDefinition(player.position).labelKey),
					formatAge(player.age),
					player.jerseyNumber ? `#${player.jerseyNumber}` : null
				]
					.filter(Boolean)
					.join(' · ')
			: ''
	);
</script>

{#if !player}
	<PageHeader
		title={t('error.playerNotFound')}
		back={{ href: '/admin/joueurs', label: t('admin.backToPlayers') }}
	>
		{#snippet actions()}
			<a class="btn-secondary" href="/admin/joueurs">{t('common.back')}</a>
		{/snippet}
	</PageHeader>
{:else}
	<PageHeader
		title={player.fullName}
		meta={headerMeta}
		back={{ href: '/admin/joueurs', label: t('admin.backToPlayers') }}
	>
		{#snippet leading()}
			<Avatar player={player} size={48} />
		{/snippet}
		{#snippet actions()}
			{#if player.role !== 'player'}
				<span class="badge-ice"
					>{t(roleDefinition(player.role)?.labelKey ?? 'admin.role.player')}</span
				>
			{/if}
			{#if !player.active}
				<span class="badge-alert">{t('admin.inactive')}</span>
			{/if}
			{#if player.isSubstitute}
				<span class="badge-ice">{t('profile.substitute')}</span>
				<form method="POST" action="?/favorite" use:progressiveForm>
					<input type="hidden" name="value" value={data.isFavorite ? 'false' : 'true'} />
					<button class="btn-ghost btn-sm" type="submit">
						{data.isFavorite ? t('subs.removeFavorite') : t('subs.addFavorite')}
					</button>
				</form>
			{/if}
			<form method="POST" action="?/resend" use:progressiveForm>
				<button class="btn-secondary btn-sm" type="submit">{t('admin.reinvite')}</button>
			</form>
		{/snippet}
	</PageHeader>

	<div class="page-stack">
		<FormFeedback {form} />

		<SectionCard title={t('admin.account')}>
			<p class="hint">{t('admin.accountHelp')}</p>
			<div class="mt-4 grid gap-5 sm:grid-cols-2">
				<form method="POST" action="?/role" use:progressiveForm>
					<label class="label" for="role">{t('admin.role')}</label>
					<select
						class="input"
						id="role"
						name="role"
						disabled={isSelf}
						value={activeRole}
						onchange={(event) => (selectedRole = event.currentTarget.value as Role)}
					>
						{#each ROLES as role (role.key)}
							<option value={role.key}>{t(role.labelKey)}</option>
						{/each}
					</select>
					<p class="hint">{t('admin.roleHelp')}</p>
					{#if selectedRoleDefinition}
						<p class="mt-3 text-body text-muted">
							{t(selectedRoleDefinition.descriptionKey)}
						</p>
						<ul role="list" class="mt-2 flex flex-wrap gap-1.5">
							{#each selectedRoleDefinition.capabilities as capability (capability)}
								<li class="badge">{t(capabilityDefinition(capability)?.labelKey ?? 'admin.roleHelp')}</li>
							{/each}
						</ul>
					{/if}
					{#if !isSelf}
						<button class="btn-secondary btn-sm mt-3" type="submit">{t('common.save')}</button>
					{/if}
				</form>
				<div>
					<dl class="fact">
						<dt>{t('admin.status')}</dt>
						<dd>{player.active ? t('admin.active') : t('admin.inactive')}</dd>
					</dl>
					<p class="hint">{t('admin.statusHelp')}</p>
					{#if !isSelf}
						<form method="POST" action="?/status" use:progressiveForm class="mt-3">
							<input type="hidden" name="active" value={player.active ? 'false' : 'true'} />
							<button class="btn-secondary btn-sm" type="submit">
								{player.active ? t('admin.deactivate') : t('admin.reactivate')}
							</button>
						</form>
					{/if}
				</div>
			</div>

			{#if !isSelf && player.role !== 'admin'}
				<div class="mt-5 border-t border-line pt-4">
					<h3 class="text-subhead font-semibold text-alert">{t('admin.deletePlayer')}</h3>
					<p class="hint mt-1">{t('admin.deletePlayerHelp')}</p>
					<form method="POST" action="?/delete" use:progressiveForm class="mt-3">
						<ConfirmSubmit
							label={t('admin.deletePlayer')}
							question="{t('admin.deletePlayerTitle', { name: player.fullName })} {t(
								'admin.deletePlayerConfirm'
							)}"
							class="btn-danger btn-sm"
						/>
					</form>
				</div>
			{/if}
		</SectionCard>

		<div class="grid gap-4 lg:grid-cols-2 lg:items-start">
			<SectionCard title={t('admin.editPlayer')}>
				<form method="POST" action="?/profile" use:progressiveForm class="grid gap-3 sm:grid-cols-2">
					<div>
						<label class="label" for="firstName">{t('profile.firstName')}</label>
						<input class="input" id="firstName" name="firstName" value={player.firstName} required />
					</div>
					<div>
						<label class="label" for="lastName">{t('profile.lastName')}</label>
						<input class="input" id="lastName" name="lastName" value={player.lastName} required />
					</div>
					<div>
						<label class="label" for="age">{t('profile.age')}</label>
						<input
							class="input"
							id="age"
							name="age"
							type="number"
							min={PLAYER_LIMITS.ageMin}
							max={PLAYER_LIMITS.ageMax}
							value={player.age}
							required
						/>
					</div>
					<div>
						<label class="label" for="position">{t('profile.position')}</label>
						<select class="input" id="position" name="position" bind:value={position}>
							{#each POSITIONS as entry (entry.key)}
								<option value={entry.key}>{t(entry.labelKey)}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="label" for="jerseyNumber">{t('admin.jerseyNumber')}</label>
						<input
							class="input"
							id="jerseyNumber"
							name="jerseyNumber"
							type="number"
							inputmode="numeric"
							min={PLAYER_LIMITS.jerseyMin}
							max={PLAYER_LIMITS.jerseyMax}
							value={player.jerseyNumber ?? ''}
							placeholder={String(PLAYER_LIMITS.jerseyExample)}
						/>
					</div>
					<div class="sm:col-span-2">
						{#if data.avatarPicker}
							<AvatarPicker
								name="avatarId"
								selected={data.avatarPicker.selected}
								taken={data.avatarPicker.taken}
								help={t('admin.avatarHelp')}
								position={position}
								legendsTitle={t('admin.legendsTitle')}
								legendsHelp={t('admin.legendsHelp')}
							/>
						{/if}
					</div>
					<div class="sm:col-span-2">
						<button class="btn-primary btn-sm" type="submit">{t('common.save')}</button>
					</div>
				</form>
			</SectionCard>

			<SectionCard
				title={t('rating.title')}
				href="/admin/evaluations/{player.userId}"
				linkLabel={t('rating.edit')}
			>
				<p class="hint">{t('rating.scaleHelp')}</p>
				<dl class="mt-3 divide-y divide-line">
					<div class="fact">
						<dt>{t('rating.overall')}</dt>
						<dd>
							{data.ratings?.overall == null
								? t('rating.notRated')
								: formatDecimal(data.ratings.overall, 2)}
						</dd>
					</div>
					<div class="fact">
						<dt>{t('rating.form')}</dt>
						<dd>
							{data.ratings?.form.average == null
								? t('rating.notAvailable')
								: formatDecimal(data.ratings.form.average, 2)}
							<span class="ml-1 text-meta font-normal text-muted">
								({formatCount(
									data.ratings?.form.games ?? 0,
									'rating.gamesRated.one',
									'rating.gamesRated.many'
								)})
							</span>
						</dd>
					</div>
					<div class="fact">
						<dt>{t('rating.positionTitle')}</dt>
						<dd>
							{t('rating.positionCriteria', {
								done: data.ratings ? Object.keys(data.ratings.positionValues).length : 0,
								total: data.ratings?.positionTotal ?? 0
							})}
						</dd>
					</div>
					{#if data.ratings?.updatedAt}
						<div class="fact">
							<dt>{t('rating.lastUpdated')}</dt>
							<dd>{formatTimestamp(data.ratings.updatedAt)}</dd>
						</div>
					{/if}
				</dl>
			</SectionCard>
		</div>

		<div id="solde" class="scroll-mt-[var(--anchor-offset)]">
			<SectionCard title={t('balance.title')}>
				<div class="mb-3 flex flex-wrap justify-end">
					<form method="POST" action="?/applyDefaults" use:progressiveForm>
						<ConfirmSubmit
							label={t('balance.applyDefaults')}
							question={t('balance.applyDefaultsConfirm')}
							class="btn-ghost btn-sm"
						/>
					</form>
				</div>

				{#if data.balance}
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
								tone: data.balance.isOverdue ? ('alert' as const) : undefined
							}
						]}
					/>
				{:else}
					<p class="text-body text-muted">{t('balance.noPlan')}</p>
				{/if}

				<div class="mt-5 grid gap-5 lg:grid-cols-2">
					<form id="plan" method="POST" action="?/plan" use:progressiveForm class="space-y-3">
						<h3 class="text-subhead font-semibold">{t('balance.editPlan')}</h3>
						<div>
							<label class="label" for="total">{t('balance.totalCents')}</label>
							<div class="relative">
								<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-muted">{symbol}</span>
								<input class="input pl-7" id="total" name="total" type="number" inputmode="decimal" min={MONEY_INPUT.min} step={MONEY_INPUT.step} value={data.plan?.total} required />
							</div>
						</div>
						<div>
							<label class="label" for="firstPercent">{t('balance.firstPercent')}</label>
							<div class="relative">
								<input
									class="input pr-8"
									id="firstPercent"
									name="firstPercent"
									type="number"
									inputmode="numeric"
									min={FINANCE_LIMITS.firstInstallmentPercent.min}
									max={FINANCE_LIMITS.firstInstallmentPercent.max}
									value={data.plan?.firstPercent}
									required
								/>
								<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body text-muted">%</span>
							</div>
						</div>
						<div class="grid gap-3 sm:grid-cols-2">
							<div>
								<label class="label" for="firstDueDate">{t('balance.firstDue')}</label>
								<input class="input" id="firstDueDate" name="firstDueDate" type="date" value={data.plan?.firstDueDate} />
							</div>
							<div>
								<label class="label" for="secondDueDate">{t('balance.secondDue')}</label>
								<input class="input" id="secondDueDate" name="secondDueDate" type="date" value={data.plan?.secondDueDate} />
							</div>
						</div>
						<button class="btn-secondary btn-sm" type="submit">{t('common.save')}</button>
					</form>

					{#if data.balance?.planActive}
						<form method="POST" action="?/payment" use:progressiveForm class="space-y-3">
							<h3 class="text-subhead font-semibold">{t('balance.recordPayment')}</h3>
							<div class="grid gap-3 sm:grid-cols-2">
								<div>
									<label class="label" for="amount">{t('balance.amount')}</label>
									<div class="relative">
										<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-muted">{symbol}</span>
										<input class="input pl-7" id="amount" name="amount" type="number" inputmode="decimal" min={MONEY_INPUT.positiveMin} step={MONEY_INPUT.step} value={data.plan?.amount} required />
									</div>
								</div>
								<div>
									<label class="label" for="paidAt">{t('balance.paymentDate')}</label>
									<input class="input" id="paidAt" name="paidAt" type="date" value={data.plan?.today} required />
								</div>
							</div>
							<div>
								<label class="label" for="method">{t('balance.method')}</label>
								<select class="input" id="method" name="method">
									{#each PAYMENT_METHODS as method (method.key)}
										<option value={method.key}>{t(method.labelKey)}</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="label" for="note">{t('balance.note')}</label>
								<input class="input" id="note" name="note" maxlength="500" />
							</div>
							<button class="btn-primary btn-sm" type="submit">{t('balance.recordPayment')}</button>
						</form>
					{:else}
						<div class="space-y-2">
							<h3 class="text-subhead font-semibold">{t('balance.recordPayment')}</h3>
							<p class="text-body text-muted">{t('balance.noPlan')}</p>
							<p class="hint">{t('balance.noPlanHelp')}</p>
							<a class="btn-secondary btn-sm" href="#plan">{t('balance.editPlan')}</a>
						</div>
					{/if}
				</div>
			</SectionCard>
		</div>

		<SectionCard title={t('balance.history')} flush>
			{#if data.payments.length === 0}
				<p class="section-row text-body text-muted">{t('balance.noPayments')}</p>
			{:else}
				<ul class="divide-y divide-line">
					{#each data.payments as payment (payment.id)}
						<li class="section-row flex flex-wrap items-center justify-between gap-2 text-body">
							<div>
								<p class="numeric text-body">
									{formatMoney(payment.amountCents, data.currency)}
								</p>
								<p class="break-words text-meta text-muted">
									{formatDate(payment.paidAt, 'year')} · {t(paymentDefinition(payment.method).labelKey)}
									{#if payment.note}· {payment.note}{/if}
								</p>
							</div>
							<form method="POST" action="?/deletePayment" use:progressiveForm>
								<input type="hidden" name="paymentId" value={payment.id} />
								<ConfirmSubmit
									label={t('common.delete')}
									question={t('balance.deletePaymentConfirm', {
										amount: formatMoney(payment.amountCents, data.currency),
										date: formatDate(payment.paidAt, 'year')
									})}
									class="btn-ghost btn-sm"
								/>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			{#if data.balance}
				<div class="section-row border-t border-line">
					<ul role="list" class="space-y-1 text-meta text-muted">
						{#each data.balance.installments as installment (installment.number)}
							{@const installmentStatus = balanceStatusDefinition(installment.status)}
							<li class="flex flex-wrap items-center gap-2">
								<span>{t('balance.installment', { number: installment.number })} :</span>
								<span class="numeric">{formatMoney(installment.remainingCents, data.balance.currency)}</span>
								<span>
									{#if installment.status === 'paid'}
										{#if installment.paidAt}
											{t('balance.paidOn', { date: formatDate(installment.paidAt, 'year') })}
										{/if}
									{:else if installment.dueDate}
										{t('balance.dueOn', { date: formatDate(installment.dueDate, 'year') })}
									{:else}
										{t('balance.dueDatePending')}
									{/if}
								</span>
								<span class={badgeClass(installmentStatus.tone)}>
									{t(installmentStatus.labelKey)}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</SectionCard>
	</div>
{/if}
