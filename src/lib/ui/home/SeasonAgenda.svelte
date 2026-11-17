<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import {
		formatMonthLabel,
		formatTime,
		formatWeekdayShort,
		t
	} from '#lib/shared/i18n/index.ts';
	import { badgeClass, type BadgeTone } from '#lib/ui/badge-tone.ts';
	import { scoreLine, type GameScore } from '#lib/ui/score.ts';
	import SectionCard from '#lib/ui/SectionCard.svelte';

	type AgendaGame = {
		id: string;
		gameDate: string;
		startTime: string;
		location: string;
		status: 'scheduled' | 'cancelled' | 'completed';
		availability: 'present' | 'absent' | null;
		requestOpen?: boolean;
		score?: GameScore | null;
	};

	type MonthGroup = { month: string; label: string; games: AgendaGame[] };

	let {
		upcoming,
		past
	}: {
		upcoming: AgendaGame[];
		past: AgendaGame[];
	} = $props();

	/** Un sous-titre de mois seulement quand le mois change, jamais une grille. */
	function byMonth(games: AgendaGame[]): MonthGroup[] {
		const groups: MonthGroup[] = [];
		for (const game of games) {
			const month = game.gameDate.slice(0, 7);
			let group = groups.at(-1);
			if (!group || group.month !== month) {
				group = { month, label: formatMonthLabel(month), games: [] };
				groups.push(group);
			}
			group.games.push(game);
		}
		return groups;
	}

	const upcomingMonths = $derived(byMonth(upcoming));
	const pastMonths = $derived(byMonth(past));

	function attendanceTone(availability: AgendaGame['availability']): BadgeTone {
		if (availability === 'present') return 'ok';
		if (availability === 'absent') return 'alert';
		return 'neutral';
	}

	function attendanceLabel(availability: AgendaGame['availability']): string {
		if (availability === 'present') return t('availability.present');
		if (availability === 'absent') return t('availability.absent');
		return t('availability.noAnswer');
	}

	function dayNumber(date: string): string {
		return String(Number(date.slice(8, 10)));
	}

</script>

<SectionCard title={t('home.agenda')} href="/matchs" linkLabel={t('home.allGames')} flush>
	<div class="agenda-split">
		<div class="agenda-columns">
			<section>
				<h3 class="border-b border-line bg-paper-deep/60 px-4 py-2 text-caption font-semibold text-muted">
					{t('home.upcoming')}
				</h3>
				{#if upcomingMonths.length === 0}
					<p class="px-4 py-4 text-body text-muted">{t('home.noGame')}</p>
				{:else}
					{#each upcomingMonths as group (group.month)}
						<h4 class="px-4 pb-1 pt-3 text-caption font-semibold text-muted">{group.label}</h4>
						<ul role="list">
							{#each group.games as game (game.id)}
								<li class="border-t border-line first:border-t-0">
									<a
										href="/matchs/{game.id}"
										class="flex min-h-14 flex-wrap items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-paper-deep/40"
									>
										<span class="record-date">{formatWeekdayShort(game.gameDate)} {dayNumber(game.gameDate)}</span>
										<span class="order-4 min-w-0 flex-1 basis-full sm:order-none sm:basis-0">
											<span class="block break-words text-body font-semibold">
												{formatTime(game.startTime)} · {game.location}
											</span>
											{#if game.requestOpen}
												<span class="mt-0.5 block text-meta text-accent-deep">
													{t('subs.ownRequestOpen')}
												</span>
											{/if}
										</span>
										{#if game.status === 'cancelled'}
											<span class="{badgeClass(gameStatus(game.status).tone)} order-2 ml-auto shrink-0 sm:order-none sm:ml-0">
												{t(gameStatus(game.status).labelKey)}
											</span>
										{:else}
											<span class="{badgeClass(attendanceTone(game.availability))} order-2 ml-auto shrink-0 sm:order-none sm:ml-0">
												{attendanceLabel(game.availability)}
											</span>
										{/if}
										<svg
											viewBox="0 0 24 24"
											class="order-3 h-4 w-4 shrink-0 text-muted sm:order-none"
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
					{/each}
				{/if}
			</section>

			{#if past.length > 0}
				<section class="border-t border-line">
					<h3
						class="border-b border-line bg-paper-deep/60 px-4 py-2 text-caption font-semibold text-muted"
					>
						{t('home.results')}
					</h3>
					{#each pastMonths as group (group.month)}
						<h4 class="px-4 pb-1 pt-3 text-caption font-semibold text-muted">{group.label}</h4>
						<ul role="list">
							{#each group.games as game (game.id)}
								<li class="border-t border-line first:border-t-0">
									<a
										href="/matchs/{game.id}"
										class="flex min-h-14 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-paper-deep/40"
									>
										<span class="record-date">{formatWeekdayShort(game.gameDate)} {dayNumber(game.gameDate)}</span>
										<span class="min-w-0 flex-1">
											<span class="block break-words text-body font-semibold">
												{formatTime(game.startTime)} · {game.location}
											</span>
											<span class="mt-0.5 block truncate text-meta text-muted">
												{#if game.status === 'cancelled'}
													{t(gameStatus(game.status).labelKey)}
												{:else if game.score}
													{scoreLine(game.score)}
												{:else}
													{attendanceLabel(game.availability)}
												{/if}
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
					{/each}
				</section>
			{/if}
		</div>
	</div>
</SectionCard>
