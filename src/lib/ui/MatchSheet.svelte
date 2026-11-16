<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import type { GameSummary } from '#lib/domain/games/types.ts';
	import type { AvailabilityView } from '#lib/domain/availability/service.ts';
	import {
		formatDayMonth,
		formatTime,
		formatTimeParts,
		formatWeekday,
		t
	} from '#lib/shared/i18n/index.ts';

	let {
		game,
		availability,
		teamName
	}: {
		game: Pick<GameSummary, 'id' | 'gameDate' | 'startTime' | 'location' | 'status'>;
		availability: AvailabilityView | null;
		teamName?: string | null;
	} = $props();

	const time = $derived(formatTimeParts(game.startTime));
	const cancelled = $derived(game.status === 'cancelled');
</script>

<section class="scoreboard relative">
	<div class="grid gap-4 px-5 pb-4 pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-6">
		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-2">
				<p class="serial text-paper/60">{t('home.nextGame')}</p>
				{#if cancelled}
					<span class="stamp border-alert bg-alert-soft text-alert">
						{t(gameStatus(game.status).labelKey)}
					</span>
				{/if}
				{#if teamName}
					<span class="stamp border-paper/40 text-paper/80">{teamName}</span>
				{/if}
			</div>

			<p class="mt-3 font-display text-2xl font-semibold leading-tight text-paper sm:text-[1.75rem]">
				{formatWeekday(game.gameDate)} {formatDayMonth(game.gameDate)}
			</p>
			<p class="mt-1 text-sm leading-snug text-paper/70">{game.location}</p>
		</div>

		<div class="text-left sm:text-right">
			<p class="sr-only">{formatTime(game.startTime)}</p>
			<p aria-hidden="true" class="clock text-paper">
				{time.hour}<span class="mx-3 inline-block font-sans text-[0.45em] font-semibold text-paper/60"
					>{t('common.hourShort')}</span
				>{time.minute}
			</p>
		</div>
	</div>

	<div class="mx-5 h-px bg-paper/15 sm:mx-6"></div>

	<div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
		<div class="min-w-0">
			{#if availability?.substitute}
				<p class="text-sm text-paper/70">{t('availability.substituteHint')}</p>
			{:else if availability}
				<p class="font-mono text-[11px] text-paper/85">{availability.summary}</p>
				{#if availability.canRespond}
					<p class="mt-0.5 text-xs text-paper/55">
						{t('home.deadline', { date: availability.closesAtLabel })}
					</p>
				{/if}
			{/if}
		</div>

		<div class="w-full sm:w-auto">
			{#if availability?.canRespond}
				<a class="btn-on-ink w-full sm:w-auto" href="#presence">{t('availability.answer')}</a>
			{:else}
				<a class="btn border border-paper/40 text-paper hover:bg-paper/15 w-full sm:w-auto" href="/matchs/{game.id}">
					{t('home.viewGame')}
				</a>
			{/if}
		</div>
	</div>
</section>
