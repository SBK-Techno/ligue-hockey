<script lang="ts">
	import { balanceStatusDefinition } from '#config/balance-status.ts';
	import { gameStatus } from '#config/game-status.ts';
	import { NOTIFICATION_CHANNELS } from '#config/notification-channels.ts';
	import { positionDefinition } from '#config/positions.ts';
	import {
		formatCount,
		formatDate,
		formatMoney,
		formatTime,
		formatTimestamp,
		t
	} from '#lib/shared/i18n/index.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import RecordRow from '#lib/ui/RecordRow.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import StatStrip from '#lib/ui/StatStrip.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hasTodo = $derived(data.unpaid.length > 0 || data.requests.length > 0);
	const openSlots = $derived(
		data.nextGame?.slots.filter((slot) => !slot.player).length ?? 0
	);
	const pendingNames = $derived(
		data.nextAvailability?.pending.map((entry) => entry.fullName) ?? []
	);
	const SUPPRESSIONS = [
		{ key: 'channel_disabled', labelKey: 'notifications.suppression.channelDisabled' },
		{ key: 'preference_disabled', labelKey: 'notifications.suppression.preferenceDisabled' },
		{ key: 'no_push_subscription', labelKey: 'notifications.suppression.noPushSubscription' }
	] as const;

	function channelLabel(channel: string): string {
		const definition = NOTIFICATION_CHANNELS.find((entry) => entry.key === channel);
		return definition ? t(definition.labelKey) : channel;
	}
</script>

<PageHeader title={t('admin.dashboard')} meta={t('admin.dashboardHelp')} />

<div class="page-stack">
	<StatStrip
		cells={[
			...(data.permissions.balances
				? [
						{
							value: data.counts.unpaid,
							label: `${t('admin.toReceive')}${
								data.outstandingCents > 0 && data.currency
									? ` · ${formatMoney(data.outstandingCents, data.currency)}`
									: ''
							}`,
							tone: data.counts.overdue > 0 ? ('alert' as const) : undefined
						}
					]
				: []),
			...(data.permissions.balances
				? [{ value: data.counts.noPlan, label: t('balance.noPlanShort') }]
				: []),
			...(data.permissions.subs
				? [{ value: data.counts.openRequests, label: t('admin.openRequests') }]
				: []),
			...(data.permissions.games
				? [{ value: data.counts.unanswered, label: t('availability.noAnswer') }]
				: [])
		]}
	/>

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
		{#if data.permissions.games}
			<SectionCard class="xl:col-start-1 xl:row-start-1" title={t('home.nextGame')}>
				{#if data.nextGame}
					<p class="serial">{formatDate(data.nextGame.gameDate)}</p>
					<p class="mt-1 font-display text-subhead font-semibold leading-tight">
						{formatTime(data.nextGame.startTime)} · {data.nextGame.location}
					</p>
					<div class="mt-3 flex flex-wrap gap-1.5">
						<span class={data.nextGame.generated ? 'badge-ok' : 'badge'}>
							{data.nextGame.generated ? t('games.generated') : t('games.notGenerated')}
						</span>
						{#if openSlots > 0}
							<span class="badge-ice">
								{formatCount(openSlots, 'games.openSlots.one', 'games.openSlots.many')}
							</span>
						{/if}
					</div>
					{#if data.nextAvailability}
						<p class="mt-3 font-mono text-meta text-muted">{data.nextAvailability.summary}</p>
						{#if pendingNames.length > 0}
							<p class="mt-1 text-meta leading-snug text-muted">
								{t('admin.unansweredNames', { names: pendingNames.slice(0, 5).join(', ') })}
							</p>
						{/if}
					{/if}
					<a class="btn-primary mt-4 w-full" href="/admin/matchs/{data.nextGame.id}">
						{t('admin.openSheet')}
					</a>
				{:else}
					<p class="text-body text-muted">{t('home.noGame')}</p>
					<a class="btn-secondary btn-sm mt-3" href="/admin/matchs">{t('games.adminCreate')}</a>
				{/if}
			</SectionCard>
		{/if}

		<div
			class="space-y-4 xl:col-start-1 {data.permissions.games
				? 'xl:row-start-2'
				: 'xl:row-start-1'}"
		>
			<SectionCard title={t('admin.todo')} flush>
				{#if hasTodo}
					<ul role="list" class="divide-y divide-line">
						{#if data.unpaid.length > 0}
							<li class="section-row flex flex-wrap items-center justify-between gap-2 py-2">
								<p class="micro-label">{t('admin.todoBalances', { count: data.unpaid.length })}</p>
								<a class="action-link text-meta" href="/admin/soldes">{t('admin.balances')}</a>
							</li>
							{#each data.unpaid.slice(0, 5) as balance (balance.playerId)}
								{@const status = balanceStatusDefinition(balance.status)}
								<li>
									<RecordRow
										href="/admin/joueurs/{balance.playerId}#solde"
										title={balance.playerName}
										meta={t('balance.paidOf', {
											paid: formatMoney(balance.paidCents, balance.currency),
											total: formatMoney(balance.totalCents, balance.currency)
										})}
										trailing={formatMoney(balance.outstandingCents, balance.currency)}
										badge={t(status.labelKey)}
										badgeTone={status.tone}
									/>
								</li>
							{/each}
						{/if}

						{#if data.requests.length > 0}
							<li class="section-row flex flex-wrap items-center justify-between gap-2 py-2">
								<p class="micro-label">{t('admin.todoRequests', { count: data.requests.length })}</p>
								<a class="action-link text-meta" href="/remplacants">{t('subs.title')}</a>
							</li>
							{#each data.requests.slice(0, 3) as request (request.id)}
								<li>
									<RecordRow
										href="/remplacants"
										title={t('admin.requestRow', {
											position: t(positionDefinition(request.position).labelKey)
										})}
										meta="{formatDate(request.game.gameDate, 'short')} · {request.game.location}{request.requestedByName
											? ` · ${request.requestedByName}`
											: ''}"
										badge={t('subs.placeOpen')}
										badgeTone="ice"
									/>
								</li>
							{/each}
						{/if}
					</ul>
				{:else}
					<p class="section-row text-body text-muted">
						{data.withoutPlan.length > 0 ? t('admin.noUnpaid') : t('admin.nothingTodo')}
					</p>
				{/if}
			</SectionCard>

			{#if data.permissions.balances && data.withoutPlan.length > 0}
				<SectionCard
					title={t('admin.withoutPlanTitle', { count: data.withoutPlan.length })}
					href="/admin/soldes"
					linkLabel={t('admin.balances')}
					flush
				>
					<ul role="list" class="divide-y divide-line">
						{#each data.withoutPlan.slice(0, 3) as balance (balance.playerId)}
							<li>
								<RecordRow
									href="/admin/joueurs/{balance.playerId}#solde"
									title={balance.playerName}
								/>
							</li>
						{/each}
					</ul>
				</SectionCard>
			{/if}
		</div>

		<div class="space-y-4 xl:col-start-2 xl:row-start-1 xl:row-span-2">
			{#if data.upcoming.length > 0}
				<SectionCard
					title={t('home.upcoming')}
					href="/admin/matchs"
					linkLabel={t('home.allGames')}
					flush
				>
					<ul role="list" class="divide-y divide-line">
						{#each data.upcoming as game (game.id)}
							<li>
								<RecordRow
									href="/admin/matchs/{game.id}"
									title="{formatTime(game.startTime)} · {game.location}"
									meta={formatDate(game.gameDate, 'short')}
									badge={t(gameStatus(game.status).labelKey)}
								/>
							</li>
						{/each}
					</ul>
				</SectionCard>
			{/if}

			{#if data.notifications}
				<SectionCard title={t('notifications.queue')}>
					<dl class="grid grid-cols-2 gap-3">
						<div>
							<dt class="micro-label">{t('notifications.pending')}</dt>
							<dd class="numeric text-subhead">{data.notifications.snapshot.pending}</dd>
						</div>
						<div>
							<dt class="micro-label">{t('notifications.failed')}</dt>
							<dd
								class="numeric text-subhead {data.notifications.snapshot.failed > 0
									? 'text-alert'
									: ''}"
							>
								{data.notifications.snapshot.failed}
							</dd>
						</div>
						<div>
							<dt class="micro-label">{t('notifications.oldestDue')}</dt>
							<dd class="text-meta text-muted">
								{data.notifications.snapshot.oldestDueAt
									? formatTimestamp(data.notifications.snapshot.oldestDueAt)
									: t('notifications.noneQueued')}
							</dd>
						</div>
						<div>
							<dt class="micro-label">{t('notifications.lastPush')}</dt>
							<dd class="numeric text-meta">
								{data.notifications.snapshot.push.delivered} / {data.notifications.snapshot.push
									.failed}
							</dd>
						</div>
					</dl>

					<ul class="mt-3 space-y-1 text-meta text-muted">
						{#each SUPPRESSIONS as reason (reason.key)}
							<li>
								{t(reason.labelKey)} : {data.notifications.snapshot.suppressed[reason.key]}
							</li>
						{/each}
					</ul>

					{#if data.notifications.failed.length > 0}
						<ul role="list" class="mt-4 divide-y divide-line border-t border-line">
							{#each data.notifications.failed as job (job.id)}
								<li class="py-2.5">
									<p class="text-meta font-semibold">
										{t('notifications.failedSend')} · {channelLabel(job.channel)}
									</p>
									<p class="text-caption text-muted">
										{t('notifications.attempts', { count: job.attempts })}
									</p>
									<details class="mt-1">
										<summary
											class="link inline-flex min-h-11 items-center text-caption marker:content-none"
										>
											{t('notifications.technicalDetails')}
										</summary>
										<p class="break-all text-caption text-muted">{job.eventKey}</p>
										{#if job.lastError}
											<p class="mt-1 break-words text-caption text-alert">{job.lastError}</p>
										{/if}
									</details>
									<form method="POST" action="?/retry" use:progressiveForm class="mt-1.5">
										<input type="hidden" name="jobId" value={job.id} />
										<button class="btn-secondary btn-sm" type="submit">
											{t('notifications.retry')}
										</button>
									</form>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="hint mt-3">{t('notifications.noneFailed')}</p>
					{/if}
				</SectionCard>
			{/if}
		</div>
	</div>
</div>
