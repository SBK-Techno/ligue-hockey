<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
	import { teamDefinition } from '#config/teams.ts';
	import { gameStatus } from '#config/game-status.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { formatCount, formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import InstallPrompt from '#lib/ui/InstallPrompt.svelte';
	import MatchSheet from '#lib/ui/MatchSheet.svelte';
	import RecordRow from '#lib/ui/RecordRow.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import WeekChecklist from '#lib/ui/WeekChecklist.svelte';
	import WeekStrip from '#lib/ui/WeekStrip.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const actor = $derived(data.actor.kind === 'user' ? data.actor : null);
	const isManager = $derived(actor !== null && can(actor, 'manageGames'));
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

	const nextGames = $derived(data.games.slice(1, 4));
	const absentNames = $derived(
		data.availability?.rows.filter((row) => row.status === 'absent').map((row) => row.fullName) ??
			[]
	);
	const presentNames = $derived(
		data.availability?.rows.filter((row) => row.status === 'present').map((row) => row.fullName) ??
			[]
	);
	const pendingNames = $derived(data.availability?.pending.map((entry) => entry.fullName) ?? []);
	const openForGame = $derived(
		data.game ? data.openRequests.filter((request) => request.gameId === data.game?.id).length : 0
	);
</script>

<header class="mb-3 flex flex-wrap items-end justify-between gap-2">
	<div>
		<p class="text-sm text-muted">{t('home.greeting', { name: actor?.name.split(' ')[0] ?? '' })}</p>
		<h1 class="mt-0.5">{t('admin.thisWeek')}</h1>
	</div>

</header>

{#if data.game}
	<MatchSheet
		game={data.game}
		availability={data.availability}
		teamName={ownSlot ? t(teamDefinition(ownSlot.team).labelKey) : null}
	/>

	<div class="mt-2">
		<WeekStrip games={data.games} />
	</div>

	<div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)] lg:items-start">
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
				<section class="sheet" aria-labelledby="gestion-titre">
					<header class="border-b border-line px-4 py-2.5">
						<h2 id="gestion-titre">{t('home.adminWeek')}</h2>
						<p class="mt-0.5 text-xs text-muted">{t('home.noProfileAdmin')}</p>
					</header>
					<dl class="divide-y divide-line">
						<div class="flex items-center justify-between gap-3 px-4 py-2.5">
							<dt class="text-sm text-muted">{t('home.openPlaces')}</dt>
							<dd class="numeric text-lg">{openForGame}</dd>
						</div>
						{#if data.openRequests.length > 0}
							<div class="flex items-center justify-between gap-3 px-4 py-2.5">
								<dt class="text-sm text-muted">{t('home.allRequests')}</dt>
								<dd class="numeric text-lg">{data.openRequests.length}</dd>
							</div>
						{/if}
					</dl>
					<div class="border-t border-line p-4">
						<a class="btn-primary w-full" href="/admin/matchs/{data.game.id}">
							{t('home.manageGame')}
						</a>
					</div>
				</section>
			{:else}
				<section class="sheet p-4">
					<h2>{t('home.noProfileTitle')}</h2>
					<p class="mt-1 text-sm text-muted">{t('home.noProfileHelp')}</p>
				</section>
			{/if}
		</div>

		<div class="min-w-0 space-y-4">
			{#if nextGames.length > 0}
				<SectionCard title={t('home.upcoming')} href="/matchs" linkLabel={t('home.allGames')}>
					<ul role="list" class="divide-y divide-line">
						{#each nextGames as game (game.id)}
							<li>
								<RecordRow
									href="/matchs/{game.id}"
									date={formatDate(game.gameDate, 'short')}
									title="{formatTime(game.startTime)} · {game.location}"
									meta={t(gameStatus(game.status).labelKey)}
								/>
							</li>
						{/each}
					</ul>
				</SectionCard>
			{/if}

			{#if data.availability}
				<SectionCard
					title={t('home.attendance')}
					href="/matchs/{data.game.id}"
					linkLabel={t('home.viewRoster')}
				>
					<div class="px-4 py-2.5">
						<p class="font-mono text-xs text-muted">
							{formatCount(data.availability.present, 'availability.present.one', 'availability.present.many')}
							·
							{formatCount(data.availability.absent, 'availability.absent.one', 'availability.absent.many')}
							·
							{t('availability.unknownCount', { count: data.availability.unknown })}
						</p>
						{#if absentNames.length > 0 || pendingNames.length > 0 || presentNames.length > 0}
							<details class="group mt-2">
								<summary
									class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold"
								>
									<span>{t('home.attendanceDetail')}</span>
									<svg
										viewBox="0 0 24 24"
										class="h-4 w-4 text-muted transition-transform group-open:rotate-180"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										aria-hidden="true"
									>
										<path d="m6 9 6 6 6-6" />
									</svg>
								</summary>
								<dl class="mt-1 space-y-2 border-t border-line pt-2 text-xs leading-relaxed">
									{#if presentNames.length > 0}
										<div>
											<dt class="serial">{t('availability.present')}</dt>
											<dd class="mt-0.5 text-muted">{presentNames.join(', ')}</dd>
										</div>
									{/if}
									{#if absentNames.length > 0}
										<div>
											<dt class="serial">{t('availability.absent')}</dt>
											<dd class="mt-0.5 text-muted">{absentNames.join(', ')}</dd>
										</div>
									{/if}
									{#if pendingNames.length > 0}
										<div>
											<dt class="serial">{t('availability.unknown')}</dt>
											<dd class="mt-0.5 text-muted">{pendingNames.join(', ')}</dd>
										</div>
									{/if}
								</dl>
							</details>
						{/if}
					</div>
				</SectionCard>
			{/if}

			<InstallPrompt />
		</div>
	</div>
{:else}
	<section class="sheet p-4 sm:p-5">
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
