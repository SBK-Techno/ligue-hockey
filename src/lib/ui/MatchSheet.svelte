<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import type { GameSummary } from '#lib/domain/games/types.ts';
	import type { AvailabilityView } from '#lib/domain/availability/service.ts';
	import { formatDayMonth, formatTime, formatTimeParts, formatWeekday, t } from '#lib/shared/i18n/index.ts';

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

<section class="relative rounded-sheet bg-ink text-paper shadow-lift">
	<a
		class="block px-5 pb-5 pt-4 no-underline focus-visible:outline-offset-[-3px] sm:px-6"
		href="/matchs/{game.id}"
	>
		<div class="flex items-center justify-between gap-3">
			<p class="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-paper/55">
				{t('home.nextGame')}
			</p>
			<div class="flex flex-wrap items-center justify-end gap-1.5">
				{#if cancelled}
					<span class="badge-alert">{t(gameStatus(game.status).labelKey)}</span>
				{/if}
				{#if teamName}
					<span
						class="rounded-[0.2rem] border border-paper/30 px-1.5 py-0.5 text-[11px] font-medium text-paper/80"
					>
						{teamName}
					</span>
				{/if}
			</div>
		</div>

		<div class="mt-3 flex items-end justify-between gap-4">
			<div class="min-w-0">
				<p class="font-display text-[2.35rem] leading-[0.95] text-paper sm:text-[2.9rem]">
					{formatWeekday(game.gameDate)}
				</p>
				<p class="mt-1.5 font-mono text-[13px] text-paper/70">{formatDayMonth(game.gameDate)}</p>
			</div>

			<div class="shrink-0 text-right">
				<p class="flex items-baseline justify-end">
					<span class="sr-only">{formatTime(game.startTime)}</span>
					<span aria-hidden="true" class="numeric text-[2.4rem] text-paper sm:text-[2.9rem]">
						{time.hour}
					</span>
					<span aria-hidden="true" class="mx-1 font-display text-[1.8rem] text-paper/35">:</span>
					<span aria-hidden="true" class="numeric text-[2.4rem] text-paper/85 sm:text-[2.9rem]">
						{time.minute}
					</span>
				</p>
				<p class="mt-1.5 max-w-44 text-sm leading-snug text-paper/65 sm:max-w-56">
					{game.location}
				</p>
			</div>
		</div>
	</a>

	<div class="tear-line"></div>

	<div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
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
				<a class="btn w-full bg-paper text-ink hover:bg-surface sm:w-auto" href="#presence">
					{t('availability.answer')}
				</a>
			{:else}
				<a
					class="btn w-full border border-paper/25 text-paper hover:bg-paper/10 sm:w-auto"
					href="/matchs/{game.id}"
				>
					{t('home.viewGame')}
				</a>
			{/if}
		</div>
	</div>
</section>
