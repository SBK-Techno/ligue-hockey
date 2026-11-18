<script lang="ts">
	import type { AvailabilityView } from '#lib/domain/availability/service.ts';
	import type { GameView } from '#lib/domain/games/service.ts';
	import type { GamePlayer, GameSlotView } from '#lib/domain/games/types.ts';
	import type { HeroVariant } from '#lib/domain/home/composition.ts';
	import type { SubRequestWithGame } from '#lib/domain/roster/service.ts';
	import { teamDefinition } from '#config/teams.ts';
	import { filledRequestLabel } from '#lib/ui/filled-request.ts';
	import {
		formatDayMonth,
		formatTime,
		formatTimeParts,
		formatWeekday,
		t
	} from '#lib/shared/i18n/index.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	let {
		variant,
		game,
		mapUrl,
		teamLabel,
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
		mapUrl: string | null;
		teamLabel: string | null;
		availability: AvailabilityView | null;
		ownSlot: GameSlotView | null;
		ownBench: GamePlayer | null;
		ownRequest: SubRequestWithGame | null;
		isSubstitute: boolean;
		isManager: boolean;
		hasGame: boolean;
	} = $props();

	const gameId = $derived(game?.id ?? '');
	const time = $derived(
		game ? formatTimeParts(game.startTime) : { hour: '0', minute: '00' }
	);
	const jerseyNumber = $derived(ownSlot?.player?.jerseyNumber ?? null);
	const present = $derived(availability?.own === 'present');
	const absent = $derived(availability?.own === 'absent');
	const unanswered = $derived(
		availability !== null && availability.canRespond && availability.own === null
	);
	// Le bouton de confirmation n'est chargé que si une action peut l'ouvrir.
	// svelte-ignore state_referenced_locally
	const ConfirmSubmit =
		availability?.canWithdraw || ownRequest !== null
			? (await import('#lib/ui/ConfirmSubmit.svelte')).default
			: null;
</script>

{#snippet withdrawForm()}
	{#if availability?.canWithdraw}
		<form method="POST" action="?/availability" use:progressiveForm class="mt-3">
			<input type="hidden" name="gameId" value={gameId} />
			<input type="hidden" name="status" value="absent" />
			{#if ConfirmSubmit}
				<ConfirmSubmit
					label={t('availability.withdraw')}
					question={t('availability.withdrawConfirm')}
					confirmLabel={t('availability.withdraw')}
					class="btn border border-paper/40 text-paper hover:bg-paper/15"
				/>
			{/if}
		</form>
	{/if}
{/snippet}

{#snippet presenceForm()}
	{#if availability}
		<form
			method="POST"
			action="?/availability"
			use:progressiveForm
			class="mt-2 flex flex-wrap gap-2"
		>
			<input type="hidden" name="gameId" value={gameId} />
			<button
				class="chip chip-on-ink max-w-60 justify-center"
				name="status"
				value="present"
				type="submit"
				aria-pressed={present}
			>
				{t('availability.markPresent')}
			</button>
			<button
				class="chip chip-on-ink max-w-60 justify-center"
				name="status"
				value="absent"
				type="submit"
				aria-pressed={absent}
			>
				{t('availability.markAbsent')}
			</button>
		</form>
		<p class="mt-2 text-meta text-paper/60">
			{t('home.deadline', { date: availability.closesAtLabel })}
		</p>
	{/if}
{/snippet}

{#snippet cancelRequestForm()}
	{#if ownRequest}
		<form method="POST" action="?/cancelRequest" use:progressiveForm class="mt-2">
			<input type="hidden" name="gameId" value={gameId} />
			<input type="hidden" name="requestId" value={ownRequest.id} />
			{#if ConfirmSubmit}
				<ConfirmSubmit
					label={t('subs.cancelRequest')}
					question={t('subs.cancelRequestConfirm')}
					confirmLabel={t('subs.cancelRequest')}
					class="btn border border-paper/40 text-paper hover:bg-paper/15"
				/>
			{/if}
		</form>
	{/if}
{/snippet}

{#snippet absentState()}
	{#if ownRequest?.status === 'open'}
		<p class="mt-2 text-body leading-snug text-paper/80">{t('subs.ownRequestOpen')}</p>
		{@render cancelRequestForm()}
		<a
			class="mt-2 inline-flex min-h-11 items-center text-body font-semibold text-paper underline decoration-paper/40 underline-offset-4"
			href="/remplacants"
		>
			{t('home.actionOwnRequestLink')}
		</a>
	{:else if ownRequest?.status === 'filled'}
		<p class="mt-2 text-body leading-snug text-paper/80">
			{filledRequestLabel(ownRequest)}
		</p>
	{:else}
		<p class="mt-2 text-body leading-snug text-paper/70">{t('home.absentNoRequest')}</p>
	{/if}
	{@render withdrawForm()}
{/snippet}

{#if variant === 'profile'}
	<section class="sheet p-5 sm:p-6">
		<h2>{isManager ? t('home.noProfileAdmin') : t('home.noProfileTitle')}</h2>
		{#if !isManager}
			<p class="measure mt-2 text-body leading-relaxed text-muted">
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
		<p class="measure mt-2 text-body leading-relaxed text-muted">
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
						<span class="stamp border-paper/40 text-paper/80">
							{ownBench.team
								? `${t(teamDefinition(ownBench.team).labelKey)} · ${t('home.benchStamp')}`
								: t('home.benchStamp')}
						</span>
					{/if}
				</div>

				<p
					class="mt-3 text-[length:var(--text-figure)] font-semibold leading-tight text-paper"
				>
					{formatWeekday(game.gameDate)}
					{formatDayMonth(game.gameDate)}
				</p>
				<p class="mt-1 break-words text-body leading-snug text-paper/70">{game.location}</p>
				{#if mapUrl}
					<a
						class="mt-1 inline-flex min-h-11 items-center gap-1 text-body font-semibold text-paper/75 underline decoration-paper/40 underline-offset-4"
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
						class="mx-3 inline-block font-sans text-[length:var(--text-clock-unit)] font-semibold text-paper/60"
						>{t('common.hourShort')}</span
					>{time.minute}
				</p>
			</div>
		</div>

		<div class="mx-5 h-px bg-paper/15 sm:mx-6"></div>

		<div class="px-5 py-4 sm:px-6">
			{#if variant === 'absent'}
				<span class="stamp border-alert bg-alert-soft text-alert">{t('availability.absent')}</span>
				{@render absentState()}
			{:else if variant === 'cancelled'}
				<p class="text-body leading-relaxed text-paper/80">{t('games.cancelledNotice')}</p>
			{:else if ownSlot}
				<p class="text-body leading-relaxed text-paper/85">{t('home.playing')}</p>
			{:else if isSubstitute || availability?.substitute}
				<p class="text-body leading-relaxed text-paper/75">{t('availability.substituteHint')}</p>
			{:else if unanswered && availability}
				<p class="text-body font-semibold text-paper">{t('home.availability')}</p>
				{@render presenceForm()}
			{:else if present}
				<p class="font-mono text-meta text-paper/85">{t('home.replyPresent')}</p>
				{#if availability?.canRespond}
					{@render presenceForm()}
				{:else}
					{#if availability?.canWithdraw}
						<p class="mt-1 text-meta text-paper/60">{t('availability.lockedHelp')}</p>
					{/if}
					{@render withdrawForm()}
				{/if}
			{:else if absent}
				<p class="font-mono text-meta text-paper/85">{t('home.replyAbsent')}</p>
				{@render absentState()}
			{:else if availability?.locked}
				<p class="text-body text-paper/75">{t('availability.locked')}</p>
			{:else if ownBench}
				<p class="text-body leading-relaxed text-paper/75">{t('home.teamBench')}</p>
			{/if}

			<div class="mt-3">
				<a class="btn-on-ink" href="/matchs/{game.id}">
					{variant === 'today' ? t('home.viewGame') : t('home.viewSheet')}
				</a>
			</div>
		</div>
	</section>
{/if}
