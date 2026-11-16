<script lang="ts">
	import type { GameSummary } from '#lib/domain/games/types.ts';
	import { branding } from '#lib/generated/branding.ts';
	import { formatWeekdayShort, t } from '#lib/shared/i18n/index.ts';
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
		<a
			class="week-day"
			href={game ? `/matchs/${game.id}` : '/matchs'}
			aria-current={day === today ? 'date' : undefined}
			data-game={game ? 'true' : 'false'}
		>
			<span class="text-[9px] font-semibold uppercase tracking-[0.08em]">
				{formatWeekdayShort(day)}
			</span>
			<span class="numeric text-sm">{Number(day.slice(8))}</span>
		</a>
	{/each}
</nav>
