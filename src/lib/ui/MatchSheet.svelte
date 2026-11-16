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

<section class="overflow-hidden rounded-sheet bg-ink text-paper shadow-lift">
	<a class="block px-5 pb-6 pt-6 no-underline sm:px-7 sm:pb-8 sm:pt-8" href="/matchs/{game.id}">
		<div class="flex flex-wrap items-start justify-between gap-x-8 gap-y-6">
			<div class="min-w-0">
				<h2 class="micro-label font-sans text-paper/65">{t('home.nextGame')}</h2>
				<p class="numeric mt-3 text-4xl capitalize text-paper sm:text-5xl">
					{formatWeekday(game.gameDate)}
				</p>
				<p class="mt-2 text-base font-semibold text-paper/80">
					{formatDayMonth(game.gameDate)}
				</p>
			</div>

			<div class="min-w-0 sm:text-right">
				<p class="flex items-start gap-2 sm:justify-end">
					<span class="sr-only">{formatTime(game.startTime)}</span>
					<span aria-hidden="true" class="numeric numeric-lg text-paper sm:text-[2.75rem]">
						{time.hour}
					</span>
					<span aria-hidden="true" class="mt-1 h-7 w-px bg-paper/25 sm:h-9"></span>
					<span aria-hidden="true" class="numeric numeric-lg text-paper/80 sm:text-[2.75rem]">
						{time.minute}
					</span>
				</p>
				<p class="mt-3 max-w-56 text-sm leading-snug text-paper/65 sm:ml-auto">
					{game.location}
				</p>
			</div>
		</div>

		{#if cancelled || teamName}
			<div class="mt-6 flex flex-wrap items-center gap-2">
				{#if cancelled}
					<span class="badge-alert">{t(gameStatus(game.status).labelKey)}</span>
				{/if}
				{#if teamName}
					<span
						class="rounded-[0.3rem] border border-paper/25 px-2 py-0.5 text-xs font-semibold text-paper/80"
					>
						{teamName}
					</span>
				{/if}
			</div>
		{/if}
	</a>

	<div
		class="flex flex-wrap items-center justify-between gap-3 border-t border-paper/10 bg-paper/[0.06] px-5 py-4 sm:px-7"
	>
		<div class="min-w-0">
			{#if availability?.substitute}
				<p class="text-sm text-paper/70">{t('availability.substituteHint')}</p>
			{:else if availability}
				<p class="text-sm font-semibold text-paper/90">{availability.summary}</p>
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
