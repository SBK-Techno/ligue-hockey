<script lang="ts">
	import type { CalendarDay, MonthCalendar } from '#lib/domain/home/calendar.ts';
	import {
		formatCount,
		formatDate,
		formatMonthLabel,
		formatTime,
		formatWeekday,
		formatWeekdayShort,
		t
	} from '#lib/shared/i18n/index.ts';

	let { calendar }: { calendar: MonthCalendar } = $props();

	const titleId = $props.id();
	const monthLabel = $derived(formatMonthLabel(calendar.month));
	const weekdays = $derived(calendar.weeks[0].map((day) => formatWeekdayShort(day.date)));

	function dayLabel(day: CalendarDay): string {
		const date = `${formatWeekday(day.date)} ${formatDate(day.date, 'year')}`;
		if (!day.inMonth || day.gameCount === 0) return date;

		if (day.gameCount === 1) {
			const game = day.games[0];
			return [
				date,
				formatTime(game.startTime),
				game.location,
				game.status === 'cancelled' ? t('games.status.cancelled') : null
			]
				.filter(Boolean)
				.join(' · ');
		}

		return [
			date,
			formatCount(day.gameCount, 'home.calendarGame.one', 'home.calendarGame.many'),
			day.cancelledCount > 0
				? t(
						day.cancelledCount === 1
							? 'home.calendarCancelledAmong'
							: 'home.calendarCancelledAmong.many',
						{ count: day.cancelledCount }
					)
				: null
		]
			.filter(Boolean)
			.join(' · ');
	}

	function hrefFor(day: CalendarDay): string | null {
		if (!day.inMonth || day.isPast || day.gameCount === 0) return null;
		if (day.gameCount > 1) return '/matchs';
		return `/matchs/${day.games[0].id}`;
	}

	function dayClass(day: CalendarDay): string {
		const base =
			'relative flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-control text-[length:var(--text-meta)] leading-none transition-colors';
		if (!day.inMonth) return `${base} text-muted/40`;
		if (day.gameCount > 0 && !day.isPast) {
			return `${base} bg-ice text-on-brand hover:bg-ice-deep ${day.isToday ? 'ring-2 ring-inset ring-accent' : ''}`;
		}
		if (day.gameCount > 0) return `${base} bg-ice-soft text-muted`;
		if (day.isToday) return `${base} text-ink ring-2 ring-inset ring-accent`;
		if (day.isPast) return `${base} text-muted`;
		return `${base} text-ink`;
	}
</script>

<section class="sheet overflow-hidden">
	<header
		class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2.5"
	>
		<h2 id={titleId}>{monthLabel}</h2>
	</header>

	<div class="p-2 sm:p-3">
		<table class="w-full table-fixed border-separate border-spacing-0" aria-labelledby={titleId}>
			<caption class="sr-only">{t('home.calendarLabel', { month: monthLabel })}</caption>
			<thead>
				<tr>
					{#each weekdays as weekday, index (index)}
						<th
							scope="col"
							class="pb-1 text-center text-[length:var(--text-stamp)] font-semibold uppercase tracking-[0.06em] text-muted"
						>
							{weekday}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each calendar.weeks as week, weekIndex (weekIndex)}
					<tr>
						{#each week as day (day.date)}
							{@const href = hrefFor(day)}
							{@const label = dayLabel(day)}
							<td
								class="p-0.5 align-middle"
								aria-label={href ? undefined : label}
								aria-current={!href && day.isToday ? 'date' : undefined}
							>
								{#if href}
									<a
										class={dayClass(day)}
										{href}
										aria-label={label}
										aria-current={day.isToday ? 'date' : undefined}
									>
										<time datetime={day.date} class="numeric" aria-hidden="true">
											{day.dayOfMonth}
										</time>
										{#if day.gameCount > 1}
											<span
												class="text-[length:var(--text-stamp)] leading-none text-paper/80"
												aria-hidden="true">{day.gameCount}</span>
										{/if}
										{#if day.hasCancelled}
											<span
												class="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-alert ring-1 ring-paper"
												aria-hidden="true"
											></span>
										{/if}
									</a>
								{:else}
									<span class={dayClass(day)} aria-hidden="true">
										<time datetime={day.date} class="numeric" aria-hidden="true">
											{day.dayOfMonth}
										</time>
										{#if day.gameCount > 1}
											<span
											class="text-[length:var(--text-stamp)] leading-none text-muted"
											aria-hidden="true"
										>
												{day.gameCount}
											</span>
										{/if}
										{#if day.hasCancelled}
											<span
												class="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-alert ring-1 ring-paper"
												aria-hidden="true"
											></span>
										{/if}
									</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
