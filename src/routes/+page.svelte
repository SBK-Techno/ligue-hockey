<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
	import { teamDefinition } from '#config/teams.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import type { I18nKey } from '#config/i18n/fr.ts';
	import {
		formatDate,
		formatDayMonth,
		formatMoney,
		formatTime,
		formatTimestamp,
		formatWeekday,
		t
	} from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import InstallPrompt from '#lib/ui/InstallPrompt.svelte';
	import AvailabilityRoster from '#lib/ui/AvailabilityRoster.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const actor = $derived(data.actor.kind === 'user' ? data.actor : null);
	const isManager = $derived(actor !== null && can(actor, 'manageGames'));
	const managementLinks = $derived([
		...(actor && can(actor, 'managePlayers')
			? [{ href: '/admin/joueurs', key: 'admin.players' as const }]
			: []),
		...(actor && can(actor, 'manageGames')
			? [{ href: '/admin/matchs', key: 'admin.games' as const }]
			: []),
		...(actor && can(actor, 'viewAllBalances')
			? [{ href: '/admin/soldes', key: 'home.manageBalances' as const }]
			: []),
		...(actor && can(actor, 'manageSettings')
			? [{ href: '/admin/parametres', key: 'admin.settings' as const }]
			: [])
	]);
	const hasProfile = $derived(data.hasPlayerProfile);
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
					(request) =>
						request.gameId === data.game?.id &&
						request.requestedByPlayerId === actor.userId
				)
			: undefined
	);
	const availability = $derived(data.availability);

	const statusKey: Record<string, I18nKey> = {
		scheduled: 'games.status.scheduled',
		cancelled: 'games.status.cancelled',
		completed: 'games.status.completed'
	};
</script>

<FormFeedback {form} class="mb-4" />

<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1>{t('home.greeting', { name: actor?.name.split(' ')[0] ?? '' })}</h1>
	</div>
	{#if ownTeam}
		<span class="badge-ice">{t('home.team')} · {t(ownTeam)}</span>
	{/if}
</div>

<div class="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
	<div class="min-w-0">
		{#if data.game}
			<section class="relative overflow-hidden rounded-card bg-ink text-paper">
		<svg
			aria-hidden="true"
			viewBox="0 0 600 600"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			class="pointer-events-none absolute -right-24 -top-28 h-[380px] w-[380px] text-paper/[0.07] sm:h-[460px] sm:w-[460px]"
		>
			<circle cx="300" cy="300" r="232" />
			<circle cx="300" cy="300" r="92" />
			<path d="M0 300h600M300 0v600" />
			<circle cx="300" cy="300" r="7" fill="currentColor" stroke="none" />
			<path d="M68 208h56v184H68M532 208h-56v184h56" />
		</svg>

		<div class="relative p-5 sm:p-7">
			<div class="flex flex-wrap items-start justify-between gap-6">
				<div>
					<p class="text-xs font-semibold text-paper/60">{t('home.nextGame')}</p>
					<p class="mt-2 font-display text-4xl font-bold capitalize leading-none sm:text-5xl">
						{formatWeekday(data.game.gameDate)}
					</p>
					<p class="mt-2 text-base font-semibold text-paper/80">
						{formatDayMonth(data.game.gameDate)}
					</p>
				</div>
				<div class="sm:text-right">
					<p class="font-display text-3xl font-bold leading-none sm:text-4xl">
						{formatTime(data.game.startTime)}
					</p>
					<p class="mt-2 max-w-56 text-sm leading-snug text-paper/60">
						{data.game.location}
					</p>
				</div>
			</div>

			<div class="mt-6 flex flex-wrap items-center gap-2">
				{#if data.game.generated && availability}
					<span class="rounded-full border border-paper/20 px-3 py-1 text-xs font-semibold text-paper/80">
						{availability.summary}
					</span>
				{/if}
				{#if ownSlot}
					<span class="rounded-full border border-paper/20 px-3 py-1 text-xs font-semibold text-paper/80">
						{t(positionDefinition(ownSlot.position).labelKey)}
					</span>
				{/if}
				{#if ownRequest}
					<span class="rounded-full border border-paper/20 bg-paper/10 px-3 py-1 text-xs font-semibold text-paper/90">
						{t('subs.ownRequestOpen')}
					</span>
				{/if}
			</div>
		</div>

		<div class="relative border-t border-paper/10 bg-paper/[0.06] p-4 sm:px-7 sm:py-5">
			{#if availability?.substitute}
				<div class="flex flex-wrap items-center justify-between gap-3">
					<p class="max-w-md text-sm text-paper/70">{t('home.substituteNotice')}</p>
					<a class="btn min-h-10 bg-paper text-ink hover:bg-surface" href="/remplacants">
						{t('home.substituteCta')}
					</a>
				</div>
			{:else if availability?.locked}
				<div class="flex flex-wrap items-center justify-between gap-3">
					<p class="text-sm font-medium text-paper/80">{t('availability.locked')}</p>
					<a class="btn min-h-10 border border-paper/25 text-paper hover:bg-paper/10" href="/matchs/{data.game.id}">
						{t('home.viewGame')}
					</a>
				</div>
			{:else if availability?.canRespond}
				<div class="flex flex-wrap items-center justify-between gap-4">
					<div>
						<p class="text-sm font-semibold">
							{#if availability.own === 'present'}
								{t('home.replyPresent')}
							{:else if availability.own === 'absent'}
								{t('home.replyAbsent')}
							{:else}
								{t('home.awaitingReply')}
							{/if}
						</p>
						<p class="mt-1 text-xs text-paper/60">
							{t('home.deadline', { date: availability.closesAtLabel })}
						</p>
					</div>
					<form
						method="POST"
						action="?/availability"
						use:progressiveForm
						class="inline-flex rounded-xl border border-paper/20 bg-paper/10 p-1"
					>
						<input type="hidden" name="gameId" value={data.game.id} />
						<button
							class="min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors {availability.own ===
							'present'
								? 'bg-paper text-ink shadow-sm'
								: 'text-paper/80 hover:bg-paper/10'}"
							name="status"
							value="present"
							type="submit"
							aria-pressed={availability.own === 'present'}
						>
							{t('availability.markPresent')}
						</button>
						<button
							class="min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors {availability.own ===
							'absent'
								? 'bg-paper text-ink shadow-sm'
								: 'text-paper/80 hover:bg-paper/10'}"
							name="status"
							value="absent"
							type="submit"
							aria-pressed={availability.own === 'absent'}
						>
							{t('availability.markAbsent')}
						</button>
					</form>
				</div>
				{#if !data.game.generated}
					<p class="mt-3 text-xs text-paper/55">{t('home.lineupSoon')}</p>
				{/if}
			{:else if isManager && !hasProfile}
				<div class="flex flex-wrap items-center justify-between gap-3">
					<p class="max-w-md text-sm text-paper/70">{t('home.adminHero')}</p>
					<a class="btn min-h-10 bg-paper text-ink hover:bg-surface" href="/admin/matchs">
						{t('home.manageSchedule')}
					</a>
				</div>
			{:else}
				<div class="flex flex-wrap items-center justify-between gap-3">
					{#if availability && !hasProfile}
						<p class="text-sm text-paper/70">{t('home.noPlayerProfile')}</p>
					{:else if isManager}
						<p class="text-sm text-paper/70">{t('home.lineupSoon')}</p>
					{/if}
					<a class="btn min-h-10 border border-paper/25 text-paper hover:bg-paper/10" href="/matchs/{data.game.id}">
						{t('home.viewGame')}
					</a>
				</div>
			{/if}
		</div>
	</section>

	{#if availability && availability.rows.length + availability.pending.length > 0}
		<section class="card mt-4">
			<div class="section-title">
				<h2>{t('home.attendance')}</h2>
				<span class="text-sm text-muted">{availability.summary}</span>
			</div>
			<div class="mt-4">
				<AvailabilityRoster {availability} viewerId={actor?.userId ?? ''} />
			</div>
		</section>
	{/if}
{:else}
	<section class="card text-center">
		<h2>{t('home.noGame')}</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-muted">
			{isManager ? t('home.noGameHelpAdmin') : t('home.noGameHelp')}
		</p>
		{#if isManager}
			<a class="btn-primary mt-4" href="/admin/matchs">{t('home.createGame')}</a>
		{/if}
	</section>
{/if}

<InstallPrompt />

{#if data.games.length > 1}
	<section class="card-flush mt-4 overflow-hidden">
		<div class="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-3.5 sm:px-5">
			<h2>{t('home.upcoming')}</h2>
			<a class="link text-sm" href="/matchs">{t('home.allGames')}</a>
		</div>
		<ul role="list" class="divide-y divide-line/70">
			{#each data.games.slice(1) as game (game.id)}
				<li>
					<a
						class="flex items-center gap-4 px-4 py-3.5 no-underline transition-colors hover:bg-ink/[0.03] focus-visible:outline-offset-[-2px] sm:px-5"
						href="/matchs/{game.id}"
					>
						<div class="w-16 shrink-0">
							<p class="text-[11px] font-semibold capitalize text-muted">
								{formatWeekday(game.gameDate)}
							</p>
							<p class="font-display text-xl font-bold leading-tight text-ink">
								{formatDate(game.gameDate, 'short')}
							</p>
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold">
								{formatTime(game.startTime)} · {game.location}
							</p>
							<p class="mt-0.5 text-xs text-muted">
								{t(statusKey[game.status] ?? 'games.status.scheduled')}
							</p>
						</div>
						<svg
							viewBox="0 0 24 24"
							class="h-4 w-4 shrink-0 text-muted"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path d="m9 6 6 6-6 6" />
						</svg>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

	</div>

	<aside class="mt-4 space-y-4 lg:mt-0">
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
			{#if isManager && !hasProfile}
				<section class="card">
					<div class="section-title">
						<h2>{t('home.management')}</h2>
						<a class="link text-sm" href="/admin">{t('common.seeAll')}</a>
					</div>
					<p class="hint">{t('home.managementHelp')}</p>
					<div class="mt-3 grid gap-2">
						{#each managementLinks as link (link.href)}
							<a class="btn-secondary btn-sm justify-start" href={link.href}>{t(link.key)}</a>
						{/each}
					</div>
				</section>
			{:else}
			<a href="/solde" class="card card-link">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h2>{t('home.balance')}</h2>
						{#if data.balance}
							<p class="mt-3 font-display text-3xl font-bold leading-none text-ink">
								{formatMoney(data.balance.outstandingCents, data.balance.currency)}
							</p>
						{:else}
							<p class="mt-3 text-sm text-muted">{t('home.balanceNone')}</p>
						{/if}
					</div>
					{#if data.balance}
						{#if data.balance.outstandingCents === 0}
							<span class="badge-ok shrink-0">{t('home.balanceClear')}</span>
						{:else if data.balance.isOverdue}
							<span class="badge-alert shrink-0">{t('home.balanceOverdue')}</span>
						{:else}
							<span class="badge-ice shrink-0">{t('home.balanceDue')}</span>
						{/if}
					{/if}
				</div>
				<p class="hint">{t('balance.onlyYou')}</p>
			</a>
			{/if}

			<section class="card">
				<div class="section-title">
					<h2>{t('home.openSlots')}</h2>
					<a class="link text-sm" href="/remplacants">{t('common.seeAll')}</a>
				</div>
				{#if data.openRequests.length === 0}
					<p class="mt-3 text-sm text-muted">{t('subs.noneOpen')}</p>
					<p class="hint">{isManager ? t('home.adminOpenSlots') : t('subs.emptyHelp')}</p>
					{#if isManager}
						<a class="btn-secondary btn-sm mt-3" href="/admin/matchs">{t('home.openRequest')}</a>
					{/if}
				{:else}
					<ul role="list" class="mt-3 space-y-1.5">
						{#each data.openRequests.slice(0, 3) as request (request.id)}
							<li>
								<a
									class="flex items-center justify-between gap-3 rounded-control bg-paper px-3 py-2.5 no-underline transition-colors hover:bg-ice-soft"
									href="/matchs/{request.gameId}"
								>
									<span class="min-w-0">
										<span class="block text-sm font-semibold text-ink">
											{t(positionDefinition(request.position).labelKey)}
										</span>
										<span class="mt-0.5 block text-xs text-muted">
											{formatDate(request.game.gameDate, 'short')} · {formatTime(
												request.game.startTime
											)}
										</span>
									</span>
									<span class="badge-ice shrink-0">{t('subs.openRequest')}</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>

		<section class="card">
			<div class="section-title">
				<h2>{t('home.chat')}</h2>
				<a class="link text-sm" href="/discussion">{t('common.seeAll')}</a>
			</div>
			{#if data.chat.length === 0}
				<p class="mt-3 text-sm text-muted">{t('chat.empty')}</p>
				<p class="hint">{t('chat.emptyHelp')}</p>
			{:else}
				<ul role="list" class="mt-3 divide-y divide-line/70">
					{#each data.chat as message (message.id)}
						<li class="py-2.5 first:pt-0 last:pb-0">
							<div class="flex items-baseline justify-between gap-3">
								<p class="truncate text-xs font-semibold text-muted">{message.authorName}</p>
								<p class="shrink-0 text-[11px] text-muted">
									{formatTimestamp(message.createdAt)}
								</p>
							</div>
							<p class="mt-1 line-clamp-2 break-words text-sm">
								{#if message.deleted}
									{t('chat.deleted')}
								{:else if message.kind === 'poll'}
									<span class="font-semibold">{t('chat.pollTag')} · </span>{message.poll?.question}
								{:else}
									{message.body}
								{/if}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</aside>
</div>
