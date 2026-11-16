<script lang="ts">
	import { mapUrlFor } from '#config/maps.ts';
	import { teamDefinition } from '#config/teams.ts';
	import type { AvailabilityView } from '#lib/domain/availability/service.ts';
	import type { GameView } from '#lib/domain/games/service.ts';
	import type { GameBenchView, GameSlotView } from '#lib/domain/games/types.ts';
	import type { HeroVariant } from '#lib/domain/home/composition.ts';
	import type { SubRequestWithGame } from '#lib/domain/roster/service.ts';
	import { filledRequestLabel } from '#lib/ui/filled-request.ts';
	import {
		formatDayMonth,
		formatTime,
		formatTimeParts,
		formatWeekday,
		t
	} from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	let {
		variant,
		game,
		availability,
		ownSlot,
		ownBench,
		ownRequest,
		isSubstitute,
		isManager,
		hasGame
	}: {
		variant: HeroVariant;
		game: GameView | null;
		availability: AvailabilityView | null;
		ownSlot: GameSlotView | null;
		ownBench: GameBenchView | null;
		ownRequest: SubRequestWithGame | null;
		isSubstitute: boolean;
		isManager: boolean;
		hasGame: boolean;
	} = $props();

	const gameId = $derived(game?.id ?? '');
	const mapUrl = $derived(game ? mapUrlFor(game.locationAddress, game.locationMapUrl) : null);
	const time = $derived(
		game ? formatTimeParts(game.startTime) : { hour: '0', minute: '00' }
	);
	const teamLabel = $derived(ownSlot ? t(teamDefinition(ownSlot.team).labelKey) : null);
	const jerseyNumber = $derived(ownSlot?.player?.jerseyNumber ?? null);
	const present = $derived(availability?.own === 'present');
	const absent = $derived(availability?.own === 'absent');
	const unanswered = $derived(
		availability !== null && availability.canRespond && availability.own === null
	);
</script>

{#snippet withdrawForm()}
	{#if availability?.canWithdraw}
		<form method="POST" action="?/availability" use:progressiveForm class="mt-3">
			<input type="hidden" name="gameId" value={gameId} />
			<input type="hidden" name="status" value="absent" />
			<ConfirmSubmit
				label={t('availability.withdraw')}
				question={t('availability.withdrawConfirm')}
				confirmLabel={t('availability.withdraw')}
				class="btn border border-paper/40 text-paper hover:bg-paper/15"
			/>
		</form>
	{/if}
{/snippet}

{#if variant === 'profile'}
	<section class="sheet p-5 sm:p-6">
		<h2>{isManager ? t('home.noProfileAdmin') : t('home.noProfileTitle')}</h2>
		{#if !isManager}
			<p class="measure mt-2 text-sm leading-relaxed text-muted">
				{t('home.noProfileHelp')}
			</p>
			<a class="btn-primary mt-4" href="/profil">{t('home.profileAction')}</a>
		{:else}
			{#if !hasGame}
				<div class="mt-4 flex flex-wrap gap-2">
					<a class="btn-primary" href="/admin/matchs">{t('home.createGame')}</a>
					<a class="btn-secondary" href="/admin">{t('home.managerAction')}</a>
				</div>
			{/if}
		{/if}
	</section>
{:else if variant === 'no-game'}
	<section class="sheet p-5 sm:p-6">
		<h2>{t('home.noGame')}</h2>
		<p class="measure mt-2 text-sm leading-relaxed text-muted">
			{isManager ? t('home.noGameHelpAdmin') : t('home.noGameHelp')}
		</p>
		<div class="mt-4 flex flex-wrap gap-2">
			{#if isManager}
				<a class="btn-primary" href="/admin/matchs">{t('home.createGame')}</a>
				<a class="btn-secondary" href="/matchs">{t('home.noGameAction')}</a>
			{:else}
				<a class="btn-primary" href="/matchs">{t('home.noGameAction')}</a>
			{/if}
		</div>
	</section>
{:else if game}
	<section class="scoreboard relative">
		<div
			class="grid gap-4 px-5 pb-4 pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-6"
		>
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<p class="serial text-paper/60">
						{variant === 'today' ? t('common.today') : t('home.nextGame')}
					</p>
					{#if variant === 'today' && game.status === 'scheduled'}
						<span class="h-2 w-2 rounded-full bg-accent" aria-hidden="true"></span>
					{/if}
					{#if game.status === 'cancelled'}
						<span class="stamp border-alert bg-alert-soft text-alert">
							{t('games.status.cancelled')}
						</span>
					{/if}
					{#if teamLabel}
						<span class="stamp border-paper/40 text-paper/80">
							{teamLabel}{jerseyNumber !== null ? ` · #${jerseyNumber}` : ''}
						</span>
					{:else if ownBench}
						<span class="stamp border-paper/40 text-paper/80">{t('home.benchStamp')}</span>
					{/if}
				</div>

				<p
					class="mt-3 font-display text-[length:var(--text-figure)] font-semibold leading-tight text-paper"
				>
					{formatWeekday(game.gameDate)}
					{formatDayMonth(game.gameDate)}
				</p>
				<p class="mt-1 break-words text-sm leading-snug text-paper/70">{game.location}</p>
				{#if mapUrl}
					<a
						class="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-paper/75 underline decoration-paper/40 underline-offset-4"
						href={mapUrl}
						target="_blank"
						rel="noreferrer"
					>
						{t('games.openMap')}
					</a>
				{/if}
			</div>

			<div class="text-left sm:text-right">
				<p class="sr-only">{formatTime(game.startTime)}</p>
				<p aria-hidden="true" class="clock text-paper">
					{time.hour}<span
						class="mx-3 inline-block font-sans text-[0.45em] font-semibold text-paper/60"
						>{t('common.hourShort')}</span
					>{time.minute}
				</p>
			</div>
		</div>

		<div class="mx-5 h-px bg-paper/15 sm:mx-6"></div>

		<div class="px-5 py-4 sm:px-6">
			{#if variant === 'absent'}
				<span class="stamp border-alert bg-alert-soft text-alert">{t('availability.absent')}</span>
				{#if ownRequest?.status === 'open'}
					<p class="mt-2 text-sm leading-snug text-paper/80">{t('subs.ownRequestOpen')}</p>
					<a
						class="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-paper underline decoration-paper/40 underline-offset-4"
						href="/remplacants"
					>
						{t('home.actionOwnRequestLink')}
					</a>
				{:else if ownRequest?.status === 'filled'}
					<p class="mt-2 text-sm leading-snug text-paper/80">
						{filledRequestLabel(ownRequest)}
					</p>
				{:else}
					<p class="mt-2 text-sm leading-snug text-paper/70">{t('home.absentNoRequest')}</p>
				{/if}
				{@render withdrawForm()}
			{:else if variant === 'cancelled'}
				<p class="text-sm leading-relaxed text-paper/80">{t('games.cancelledNotice')}</p>
			{:else if ownSlot}
				<p class="text-sm leading-relaxed text-paper/85">{t('home.playing')}</p>
			{:else if isSubstitute || availability?.substitute}
				<p class="text-sm leading-relaxed text-paper/75">{t('availability.substituteHint')}</p>
			{:else if unanswered && availability}
				<p class="text-sm font-semibold text-paper">{t('home.availability')}</p>
				<form
					method="POST"
					action="?/availability"
					use:progressiveForm
					class="mt-2 grid grid-cols-2 gap-2"
				>
					<input type="hidden" name="gameId" value={gameId} />
					<button
						class="min-h-11 rounded-control border px-3 py-2 text-sm font-semibold transition-colors {present
							? 'border-paper bg-paper text-ink'
							: 'border-paper/40 text-paper hover:bg-paper/15'}"
						name="status"
						value="present"
						type="submit"
						aria-pressed={present}
					>
						{t('availability.markPresent')}
					</button>
					<button
						class="min-h-11 rounded-control border px-3 py-2 text-sm font-semibold transition-colors {absent
							? 'border-paper bg-paper text-ink'
							: 'border-paper/40 text-paper hover:bg-paper/15'}"
						name="status"
						value="absent"
						type="submit"
						aria-pressed={absent}
					>
						{t('availability.markAbsent')}
					</button>
				</form>
				<p class="mt-2 text-xs text-paper/60">
					{t('home.deadline', { date: availability.closesAtLabel })}
				</p>
			{:else if present}
				<p class="font-mono text-xs text-paper/85">{t('home.replyPresent')}</p>
				{#if ownRequest?.status === 'open'}
					<p class="mt-1 text-sm text-paper/75">{t('subs.ownRequestOpen')}</p>
				{/if}
				{#if availability?.canWithdraw}
					<p class="mt-1 text-xs text-paper/60">{t('availability.lockedHelp')}</p>
				{/if}
				{@render withdrawForm()}
			{:else if absent}
				<p class="font-mono text-xs text-paper/85">{t('home.replyAbsent')}</p>
				{#if ownRequest?.status === 'open'}
					<p class="mt-1 text-sm text-paper/75">{t('subs.ownRequestOpen')}</p>
				{:else if ownRequest?.status === 'filled'}
					<p class="mt-1 text-sm text-paper/75">{filledRequestLabel(ownRequest)}</p>
				{/if}
				{@render withdrawForm()}
			{:else if availability?.locked}
				<p class="text-sm text-paper/75">{t('availability.locked')}</p>
			{:else if ownBench}
				<p class="text-sm leading-relaxed text-paper/75">{t('home.teamBench')}</p>
			{/if}

			<div class="mt-3">
				<a class="btn-on-ink" href="/matchs/{game.id}">
					{variant === 'today' ? t('home.viewGame') : t('home.viewSheet')}
				</a>
			</div>
		</div>
	</section>
{/if}
