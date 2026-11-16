<script lang="ts">
	import { managementTabs } from '#lib/domain/auth/destinations.ts';
	import { positionDefinition } from '#config/positions.ts';
	import { teamDefinition } from '#config/teams.ts';
	import { gameStatus } from '#config/game-status.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import InstallPrompt from '#lib/ui/InstallPrompt.svelte';
	import MatchSheet from '#lib/ui/MatchSheet.svelte';
	import WeekChecklist from '#lib/ui/WeekChecklist.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const actor = $derived(data.actor.kind === 'user' ? data.actor : null);
	const isManager = $derived(actor !== null && can(actor, 'manageGames'));
	const managementLinks = $derived(actor ? managementTabs(actor) : []);
	const hasProfile = $derived(data.hasPlayerProfile);
	const ownSlot = $derived(
		actor ? data.game?.slots.find((slot) => slot.player?.playerId === actor.userId) : undefined
	);
	const ownRequest = $derived(
		actor
			? data.openRequests.find(
					(request) =>
						request.gameId === data.game?.id && request.requestedByPlayerId === actor.userId
				)
			: undefined
	);
	const line = $derived.by(() => {
		if (!ownSlot) return null;
		return [
			t(teamDefinition(ownSlot.team).labelKey),
			t(positionDefinition(ownSlot.position).labelKey),
			ownSlot.player?.jerseyNumber ? `#${ownSlot.player.jerseyNumber}` : null
		]
			.filter(Boolean)
			.join(' · ');
	});

	const nextGames = $derived(data.games.slice(1, 3));
	const absentNames = $derived(
		data.availability?.rows.filter((row) => row.status === 'absent').map((row) => row.fullName) ??
			[]
	);
	const pendingNames = $derived(data.availability?.pending.map((entry) => entry.fullName) ?? []);
	const openForGame = $derived(
		data.game ? data.openRequests.filter((request) => request.gameId === data.game?.id).length : 0
	);
</script>

<header class="mb-4">
	<h1 class="text-[2rem] sm:text-[2.35rem]">
		{t('home.greeting', { name: actor?.name.split(' ')[0] ?? '' })}
	</h1>
</header>

{#if data.game}
	<MatchSheet
		game={data.game}
		availability={data.availability}
		teamName={ownSlot ? t(teamDefinition(ownSlot.team).labelKey) : null}
	/>

	<div class="mt-4 grid gap-4 md:grid-cols-[20rem_minmax(0,1fr)] md:items-start md:gap-5">
		<div class="space-y-4">
			<FormFeedback {form} />
			{#if hasProfile}
				<WeekChecklist
					gameId={data.game.id}
					availability={data.availability}
					generated={data.game.generated}
					line={line}
					balance={data.balance}
					openCount={openForGame}
					ownRequest={Boolean(ownRequest)}
					showSubs={data.isSubstitute || Boolean(ownRequest)}
					chat={data.chat}
				/>
			{:else if isManager}
				<section class="card" aria-labelledby="gestion-titre">
					<h2 id="gestion-titre">{t('home.adminWeek')}</h2>
					<p class="hint">{t('home.adminWeekHelp')}</p>
					<dl class="mt-3 divide-y divide-line/70 border-y border-line/70">
						<div class="flex items-center justify-between gap-3 py-2.5">
							<dt class="text-sm text-muted">{t('home.openPlaces')}</dt>
							<dd class="numeric text-lg">{openForGame}</dd>
						</div>
						{#if data.openRequests.length > 0}
							<div class="flex items-center justify-between gap-3 py-2.5">
								<dt class="text-sm text-muted">{t('home.allRequests')}</dt>
								<dd class="numeric text-lg">{data.openRequests.length}</dd>
							</div>
						{/if}
					</dl>
					<a class="btn-primary mt-4 w-full" href="/admin/matchs/{data.game.id}">
						{t('home.manageGame')}
					</a>
					<div class="mt-2 grid grid-cols-2 gap-2">
						{#each managementLinks.slice(0, 4) as link (link.href)}
							<a class="btn-secondary btn-sm" href={link.href}>{t(link.labelKey)}</a>
						{/each}
					</div>
					<p class="hint mt-3">{t('home.noProfileAdmin')}</p>
				</section>
			{:else}
				<section class="card">
					<h2>{t('home.noProfileTitle')}</h2>
					<p class="mt-2 text-sm text-muted">{t('home.noProfileHelp')}</p>
				</section>
			{/if}
		</div>

		<div class="min-w-0 space-y-4">
			{#if nextGames.length > 0}
				<section class="card-flush overflow-hidden" aria-labelledby="avenir-titre">
					<div class="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
						<h2 id="avenir-titre" class="text-lg">{t('home.upcoming')}</h2>
						<a class="link text-sm" href="/matchs">{t('home.allGames')}</a>
					</div>
					<ul role="list" class="divide-y divide-line/70">
						{#each nextGames as game (game.id)}
							<li>
								<a
									class="flex min-h-14 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-ink/[0.03] focus-visible:outline-offset-[-2px]"
									href="/matchs/{game.id}"
								>
									<span class="w-14 shrink-0 whitespace-nowrap font-mono text-xs text-muted">
										{formatDate(game.gameDate, 'short')}
									</span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm font-semibold">
											{formatTime(game.startTime)} · {game.location}
										</span>
										<span class="mt-0.5 block text-xs text-muted">
											{t(gameStatus(game.status).labelKey)}
										</span>
									</span>
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

			{#if data.availability}
				<section class="card-flush overflow-hidden" aria-labelledby="presences-titre">
					<div class="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
						<h2 id="presences-titre" class="text-lg">{t('home.attendance')}</h2>
						<a class="link text-sm" href="/matchs/{data.game.id}">{t('home.viewRoster')}</a>
					</div>
					<div class="grid grid-cols-3 divide-x divide-line/70 text-center">
						<div class="px-2 py-3">
							<p class="numeric text-2xl">{data.availability.present}</p>
							<p class="mt-0.5 text-[11px] text-muted">{t('home.present')}</p>
						</div>
						<div class="px-2 py-3">
							<p class="numeric text-2xl">{data.availability.absent}</p>
							<p class="mt-0.5 text-[11px] text-muted">{t('home.absent')}</p>
						</div>
						<div class="px-2 py-3">
							<p class="numeric text-2xl">{data.availability.unknown}</p>
							<p class="mt-0.5 text-[11px] text-muted">{t('home.pending')}</p>
						</div>
					</div>
					{#if absentNames.length > 0 || pendingNames.length > 0}
						<div class="space-y-1 border-t border-line/70 px-4 py-3 text-sm">
							{#if absentNames.length > 0}
								<p class="text-muted">
									{t('home.absentList', { names: absentNames.slice(0, 4).join(', ') })}
									{#if absentNames.length > 4}
										{t('home.moreNames', { count: absentNames.length - 4 })}
									{/if}
								</p>
							{/if}
							{#if pendingNames.length > 0}
								<p class="text-muted">
									{t('home.pendingList', { names: pendingNames.slice(0, 4).join(', ') })}
									{#if pendingNames.length > 4}
										{t('home.moreNames', { count: pendingNames.length - 4 })}
									{/if}
								</p>
							{/if}
						</div>
					{/if}
				</section>
			{/if}

			{#if hasProfile && managementLinks.length > 0}
				<section aria-labelledby="gestion-ligue">
					<div class="flex items-baseline justify-between gap-3">
						<h2 id="gestion-ligue" class="text-lg">{t('home.management')}</h2>
						<a class="link text-sm" href="/admin">{t('common.seeAll')}</a>
					</div>
					<div class="mt-2 flex flex-wrap gap-2">
						{#each managementLinks as link (link.href)}
							<a class="btn-secondary btn-sm" href={link.href}>{t(link.labelKey)}</a>
						{/each}
					</div>
				</section>
			{/if}

			<InstallPrompt />
		</div>
	</div>
{:else}
	<section class="card">
		<h2>{t('home.noGame')}</h2>
		<p class="measure mt-2 text-sm text-muted">
			{isManager ? t('home.noGameHelpAdmin') : t('home.noGameHelp')}
		</p>
		<div class="mt-4 flex flex-wrap gap-2">
			{#if isManager}
				<a class="btn-primary" href="/admin/matchs">{t('home.createGame')}</a>
			{/if}
			<a class="btn-secondary" href="/matchs">{t('games.title')}</a>
			<a class="btn-ghost" href="/discussion">{t('nav.chat')}</a>
		</div>
	</section>

	<InstallPrompt />
{/if}
