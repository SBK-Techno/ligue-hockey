<script lang="ts">
	import type { GameSummary } from '#lib/domain/games/types.ts';
	import { branding } from '#lib/generated/branding.ts';
	import { formatDate, formatWeekday, formatWeekdayShort, t } from '#lib/shared/i18n/index.ts';
	import { addDays, todayInZone } from '#lib/shared/time/clock.ts';

	let {
		games
	}: {
		games: ReadonlyArray<Pick<GameSummary, 'id' | 'gameDate' | 'status'>>;
	} = $props();

	const today = todayInZone(branding.timezone);
	const days = Array.from({ length: 7 }, (_, index) => addDays(today, index));
	const byDate = $derived(new Map(games.map((game) => [game.gameDate, game])));
</script>

<nav class="week-strip" aria-label={t('home.weekStrip')}>
	{#each days as day (day)}
		{@const game = byDate.get(day)}
		{@const label = `${formatWeekday(day)} ${formatDate(day, 'short')}`}
		{@const status = game?.status === 'cancelled' ? t('games.status.cancelled') : t('games.title')}
		{#if game}
			<a
				class="week-day"
				href="/matchs/{game.id}"
				aria-current={day === today ? 'date' : undefined}
				aria-label="{label} · {status}"
				data-game="true"
			>
				<span class="text-[9px] font-semibold uppercase tracking-[0.08em]" aria-hidden="true">
					{formatWeekdayShort(day)}
				</span>
				<time datetime={day} class="numeric text-sm" aria-hidden="true">
					{Number(day.slice(8))}
				</time>
			</a>
		{:else}
			<span class="week-day" data-game="false">
				<span class="sr-only">{label}</span>
				<span class="text-[9px] font-semibold uppercase tracking-[0.08em]" aria-hidden="true">
					{formatWeekdayShort(day)}
				</span>
				<time datetime={day} class="numeric text-sm" aria-hidden="true">
					{Number(day.slice(8))}
				</time>
			</span>
		{/if}
	{/each}
</nav>
