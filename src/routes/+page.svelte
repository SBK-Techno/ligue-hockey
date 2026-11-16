<script lang="ts">
	import { managementTabs } from '#lib/domain/auth/destinations.ts';
	import { positionDefinition } from '#config/positions.ts';
	import { teamDefinition } from '#config/teams.ts';
	import { gameStatus } from '#config/game-status.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { formatDate, formatTime, formatWeekday, t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import AvailabilityRoster from '#lib/ui/AvailabilityRoster.svelte';
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
</script>

<header class="mb-5">
	<h1>{t('home.greeting', { name: actor?.name.split(' ')[0] ?? '' })}</h1>
</header>

{#if data.game}
	<MatchSheet
		game={data.game}
		availability={data.availability}
		teamName={ownSlot ? t(teamDefinition(ownSlot.team).labelKey) : null}
	/>

	<div class="mt-4 grid gap-4 lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start lg:gap-6">
		<aside class="lg:sticky lg:top-20">
			<FormFeedback {form} class="mb-4" />
			<WeekChecklist
				gameId={data.game.id}
				availability={data.availability}
				generated={data.game.generated}
				line={line}
				balance={data.balance}
				openCount={data.openRequests.filter((request) => request.gameId === data.game?.id).length}
				ownRequest={Boolean(ownRequest)}
				showSubs={data.isSubstitute || Boolean(ownRequest)}
				chat={data.chat}
				hasProfile={hasProfile}
			/>
		</aside>

		<div class="min-w-0 space-y-4">
			{#if data.games.length > 1}
				<section class="card-flush overflow-hidden">
					<div
						class="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-3.5 sm:px-5"
					>
						<h2>{t('home.upcoming')}</h2>
						<a class="link text-sm" href="/matchs">{t('home.allGames')}</a>
					</div>
					<ul role="list" class="divide-y divide-line/70">
						{#each data.games.slice(1) as game (game.id)}
							<li>
								<a
									class="flex min-h-16 items-center gap-4 px-4 py-3 no-underline transition-colors hover:bg-ink/[0.03] focus-visible:outline-offset-[-2px] sm:px-5"
									href="/matchs/{game.id}"
								>
									<span class="w-14 shrink-0 border-r border-line pr-3">
										<span class="block text-xs font-semibold capitalize text-muted">
											{formatWeekday(game.gameDate)}
										</span>
										<span class="numeric mt-0.5 block text-lg text-ink">
											{formatDate(game.gameDate, 'short')}
										</span>
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

			{#if data.availability && data.availability.rows.length + data.availability.pending.length > 0}
				<section class="card">
					<div class="section-title">
						<h2>{t('home.attendance')}</h2>
						<span class="text-sm text-muted">{data.availability.summary}</span>
					</div>
					<div class="mt-4">
						<AvailabilityRoster
							availability={data.availability}
							viewerId={actor?.userId ?? ''}
						/>
					</div>
				</section>
			{/if}

			{#if managementLinks.length > 0}
				<section class="card">
					<div class="section-title">
						<h2>{t('home.management')}</h2>
						<a class="link text-sm" href="/admin">{t('common.seeAll')}</a>
					</div>
					<p class="hint">{t('home.managementHelp')}</p>
					<div class="mt-3 flex flex-wrap gap-2">
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
		<div class="mt-5 flex flex-wrap gap-2">
			{#if isManager}
				<a class="btn-primary" href="/admin/matchs">{t('home.createGame')}</a>
			{/if}
			<a class="btn-secondary" href="/matchs">{t('games.title')}</a>
			<a class="btn-ghost" href="/discussion">{t('nav.chat')}</a>
		</div>
	</section>

	<InstallPrompt />
{/if}
