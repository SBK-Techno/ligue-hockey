<script lang="ts">
	import { enhance } from '$app/forms';
	import { positionDefinition } from '#config/positions.ts';
	import { teamDefinition } from '#config/teams.ts';
	import { formatDate, formatMoney, formatTime, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const actor = $derived(data.actor.kind === 'user' ? data.actor : null);
	const ownSlot = $derived(
		actor
			? data.game?.slots.find(
					(slot) => slot.player && slot.player.playerId === actor.userId
				)
			: undefined
	);
	const ownTeam = $derived(ownSlot ? teamDefinition(ownSlot.team).labelKey : null);
	const ownRequest = $derived(
		actor
			? data.openRequests.find(
					(request) => request.requestedByPlayerId === actor.userId
				)
			: undefined
	);
</script>

{#if form?.message}
	<p class="success mb-4">{form.message}</p>
{/if}

<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<div>
		<p class="font-display text-xs font-bold uppercase tracking-[0.2em] text-ice">
			{t('home.greeting', { name: actor?.name.split(' ')[0] ?? '' })}
		</p>
		<h1 class="mt-1">{t('home.nextGame')}</h1>
	</div>
	{#if ownTeam}
		<span class="badge-ice">{t('home.team')} {t(ownTeam)}</span>
	{/if}
</div>

{#if data.game}
	<section class="card mb-5">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<h2 class="text-2xl">{formatDate(data.game.gameDate)}</h2>
				<p class="mt-1 text-sm text-muted">
					{formatTime(data.game.startTime)} · {data.game.location}
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				{#if data.availability}
					<span class="badge">{data.availability.summary}</span>
				{/if}
				{#if data.game.openSlots > 0}
					<span class="badge-alert">{data.game.openSlotsLabel}</span>
				{/if}
			</div>
		</div>

		<div class="mt-5 flex flex-wrap items-center gap-2">
			{#if ownRequest}
				<span class="badge-ice">{t('subs.openRequest')}</span>
			{:else if data.availability && !data.availability.locked}
				<form method="POST" action="?/availability" use:enhance class="flex flex-wrap gap-2">
					<input type="hidden" name="gameId" value={data.game.id} />
					<button
						class="btn {data.availability.own === 'present' ? 'btn-primary' : 'btn-secondary'}"
						name="status"
						value="present"
						type="submit"
					>
						{t('availability.markPresent')}
					</button>
					<button
						class="btn {data.availability.own === 'absent' ? 'btn-primary' : 'btn-secondary'}"
						name="status"
						value="absent"
						type="submit"
					>
						{t('availability.markAbsent')}
					</button>
				</form>
			{:else if data.availability?.locked}
				<span class="badge">{t('availability.locked')}</span>
			{/if}
			<a class="btn btn-ghost btn-sm ml-auto" href="/matchs/{data.game.id}">
				{t('home.viewGame')}
			</a>
		</div>
	</section>
{:else}
	<div class="card mb-5 text-center">
		<p class="text-sm text-muted">{t('home.noGame')}</p>
	</div>
{/if}

<div class="grid gap-4 sm:grid-cols-2">
	<section class="card">
		<div class="section-title">
			<h2>{t('home.balance')}</h2>
			<a href="/solde">{t('common.seeAll')}</a>
		</div>
		{#if data.balance}
			<p class="mt-3 font-display text-3xl font-bold">
				{formatMoney(data.balance.outstandingCents, data.balance.currency)}
			</p>
			{#if data.balance.isOverdue}
				<p class="mt-2"><span class="badge-alert">{t('balance.status.overdue')}</span></p>
			{:else if data.balance.outstandingCents === 0}
				<p class="mt-2"><span class="badge-ok">{t('home.balanceClear')}</span></p>
			{/if}
			<p class="hint">{t('balance.onlyYou')}</p>
		{:else}
			<p class="mt-3 text-sm text-muted">{t('balance.noPlan')}</p>
		{/if}
	</section>

	<section class="card">
		<div class="section-title">
			<h2>{t('home.openSlots')}</h2>
			<a href="/remplacants">{t('common.seeAll')}</a>
		</div>
		{#if data.openRequests.length === 0}
			<p class="mt-3 text-sm text-muted">{t('subs.noneOpen')}</p>
		{:else}
			<ul class="mt-3 space-y-2">
				{#each data.openRequests as request (request.id)}
					<li class="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
						<span class="text-sm font-semibold">
							{t(positionDefinition(request.position).labelKey)}
						</span>
						<span class="badge">{t('subs.openRequest')}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<section class="card mt-4">
	<div class="section-title">
		<h2>{t('home.chat')}</h2>
		<a href="/discussion">{t('common.seeAll')}</a>
	</div>
	{#if data.chat.length === 0}
		<p class="mt-3 text-sm text-muted">{t('chat.empty')}</p>
	{:else}
		<ul class="mt-3 divide-y divide-line/70">
			{#each data.chat as message (message.id)}
				<li class="py-2.5">
					<p class="text-xs font-semibold text-muted">{message.authorName}</p>
					<p class="line-clamp-2 text-sm">
						{message.deleted
							? t('chat.deleted')
							: message.kind === 'poll'
								? message.poll?.question
								: message.body}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>
