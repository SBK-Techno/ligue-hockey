<script lang="ts">
	import { MONEY_INPUT } from '#config/money.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { PAYMENT_METHODS, paymentDefinition } from '#config/payment-methods.ts';
	import { PLAYER_LIMITS } from '#config/players.ts';
	import { capabilityDefinition } from '#config/capabilities.ts';
	import { ROLES, roleDefinition, type Role } from '#config/roles.ts';
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { RATING_ATTRIBUTES, RATING_SCALE } from '#config/rating-attributes.ts';
	import { SETTINGS } from '#config/settings-registry.ts';
	import {
		formatAge,
		formatDate,
		formatDecimal,
		formatMoney,
		t
	} from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const player = $derived(data.player);
	let selectedRole = $state<Role | null>(null);
	const activeRole = $derived(selectedRole ?? player?.role ?? 'player');
	const selectedRoleDefinition = $derived(roleDefinition(activeRole));
	const isSelf = $derived(
		data.actor.kind === 'user' && player?.userId === data.actor.userId
	);

	const statusKey = {
		paid: 'balance.status.paid',
		partial: 'balance.status.partial',
		overdue: 'balance.status.overdue',
		upcoming: 'balance.status.upcoming'
	} as const;
</script>

<FormFeedback {form} class="mb-4" />

{#if !player}
	<div class="card">{t('error.playerNotFound')}</div>
{:else}
	<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0">
			<a class="link text-sm" href="/admin/joueurs">{t('admin.backToPlayers')}</a>
			<h1 class="mt-2">{player.fullName}</h1>
			<p class="mt-1.5 break-words text-sm text-muted">
				<span class="break-all">{player.email}</span> ·
				{t(positionDefinition(player.position).labelKey)} · {formatAge(player.age)}
				{#if player.jerseyNumber}· #{player.jerseyNumber}{/if}
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if player.role !== 'player'}
				<span class="badge-ice">
					{t(player.role === 'admin' ? 'admin.role.admin' : 'admin.role.manager')}
				</span>
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
		</div>
	</div>


	<section class="card mt-4">
		<h2>{t('admin.account')}</h2>
		<p class="hint mt-1">{t('admin.accountHelp')}</p>
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
					<p class="mt-3 text-sm text-muted">
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
				<p class="label">{t('admin.status')}</p>
				<p class="text-sm font-semibold">
					{player.active ? t('admin.active') : t('admin.inactive')}
				</p>
				<p class="hint">{t('admin.statusHelp')}</p>
				{#if !isSelf}
					<form method="POST" action="?/status" use:progressiveForm class="mt-3">
						<input type="hidden" name="active" value={player.active ? 'false' : 'true'} />
						<button class="btn-secondary btn-sm" type="submit">
							{player.active ? t('admin.inactive') : t('admin.active')}
						</button>
					</form>
				{/if}
			</div>
		</div>

		{#if !isSelf && player.role !== 'admin'}
			<div class="mt-5 rounded-control border border-alert/20 bg-alert-soft/40 p-4">
				<h3 class="text-sm font-semibold text-alert">{t('admin.deletePlayer')}</h3>
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
	</section>

	<div class="grid gap-4 lg:grid-cols-2">
		<section class="card">
			<h2 class="mb-3">{t('admin.editPlayer')}</h2>
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
					<select class="input" id="position" name="position">
						{#each POSITIONS as position (position.key)}
							<option value={position.key} selected={position.key === player.position}>
								{t(position.labelKey)}
							</option>
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
					<button class="btn-primary btn-sm" type="submit">{t('common.save')}</button>
				</div>
			</form>
		</section>

		<section class="card">
			<h2 class="mb-1">{t('admin.ratings')}</h2>
			<p class="hint mb-3">
				{t('admin.ratingsHelp', {
					min: RATING_SCALE.min,
					max: RATING_SCALE.max
				})}
			</p>
			<form
				method="POST"
				action="?/ratings"
				use:progressiveForm
				class="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3"
			>
				{#each RATING_ATTRIBUTES as attribute (attribute.key)}
					<div>
						<label class="label" for={attribute.key}>{t(attribute.labelKey)}</label>
						<select class="input" id={attribute.key} name={attribute.key} required>
							{#each Array.from({ length: RATING_SCALE.max - RATING_SCALE.min + 1 }, (_, index) => RATING_SCALE.min + index) as value (value)}
								<option value={value} selected={data.ratings?.values[attribute.key] === value}>
									{value}
								</option>
							{/each}
						</select>
					</div>
				{/each}
				<div class="col-span-2 flex items-center justify-between gap-2">
					<span class="badge">
						{t('rating.overall')} :
						{data.ratings?.overall == null
							? t('rating.notRated')
							: formatDecimal(data.ratings.overall, 2)}
					</span>
					<button class="btn-primary btn-sm" type="submit">{t('common.save')}</button>
				</div>
			</form>
		</section>
	</div>

	<section class="card mt-4">
		<div class="section-title">
			<h2>{t('balance.title')}</h2>
			<div class="flex flex-wrap gap-2">
				<form method="POST" action="?/applyDefaults" use:progressiveForm>
					<ConfirmSubmit
						label={t('balance.applyDefaults')}
						question={t('balance.applyDefaultsConfirm')}
						class="btn-ghost btn-sm"
					/>
				</form>
			</div>
		</div>

		{#if data.balance}
			<div class="mt-3 grid gap-2 sm:grid-cols-3">
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
		{:else}
			<p class="mt-3 text-sm text-muted">{t('balance.noPlan')}</p>
		{/if}

		<div class="mt-5 grid gap-5 lg:grid-cols-2">
			<form method="POST" action="?/plan" use:progressiveForm class="space-y-3">
				<h3 class="text-sm font-semibold">{t('balance.editPlan')}</h3>
				<div>
					<label class="label" for="total">{t('balance.totalCents')}</label>
					<div class="relative">
						<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
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
							min={SETTINGS['finance.firstInstallmentPercent'].min}
							max={SETTINGS['finance.firstInstallmentPercent'].max}
							value={data.plan?.firstPercent}
							required
						/>
						<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
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

			<form method="POST" action="?/payment" use:progressiveForm class="space-y-3">
				<h3 class="text-sm font-semibold">{t('balance.recordPayment')}</h3>
				<div class="grid gap-3 sm:grid-cols-2">
					<div>
						<label class="label" for="amount">{t('balance.amount')}</label>
						<div class="relative">
							<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
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
		</div>
	</section>

	<section class="card mt-4">
		<h2 class="mb-3">{t('balance.history')}</h2>
		{#if data.payments.length === 0}
			<p class="text-sm text-muted">{t('balance.noPayments')}</p>
		{:else}
			<ul class="divide-y divide-line/70">
				{#each data.payments as payment (payment.id)}
					<li class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
						<div>
							<p class="font-semibold">
								{formatMoney(payment.amountCents, data.currency)}
							</p>
							<p class="break-words text-xs text-muted">
								{formatDate(payment.paidAt, 'year')} · {t(paymentDefinition(payment.method).labelKey)}
								{#if payment.note}· {payment.note}{/if}
							</p>
						</div>
						<form method="POST" action="?/deletePayment" use:progressiveForm>
							<input type="hidden" name="paymentId" value={payment.id} />
							<ConfirmSubmit
								label={t('common.delete')}
								question={t('balance.deletePaymentConfirm')}
								class="btn-ghost btn-sm"
							/>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
		{#if data.balance}
			<ul role="list" class="mt-3 space-y-1 text-xs text-muted">
				{#each data.balance.installments as installment (installment.number)}
					<li class="flex flex-wrap items-center gap-2">
						<span>{t('balance.installment', { number: installment.number })} :</span>
						<span>{formatMoney(installment.remainingCents, data.balance.currency)}</span>
						<span class="badge">{t(statusKey[installment.status])}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
