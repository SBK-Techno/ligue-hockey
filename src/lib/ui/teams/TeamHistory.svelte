<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import { TEAMS } from '#config/teams.ts';
	import type { TeamHistoryEntry } from '#lib/domain/games/service.ts';
	import { formatDate, formatTime, formatWeekday, t } from '#lib/shared/i18n/index.ts';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import TeamMark from '#lib/ui/teams/TeamMark.svelte';

	let {
		entries,
		selectedId
	}: {
		entries: readonly TeamHistoryEntry[];
		selectedId: string;
	} = $props();
</script>

{#if entries.length === 0}
	<p class="section-row text-body text-muted">{t('teams.historyEmpty')}</p>
{:else}
	<ul role="list" class="divide-y divide-line">
		{#each entries as entry (entry.id)}
			{@const selected = entry.id === selectedId}
			{@const status = gameStatus(entry.status)}
			<li>
				<a
					class="flex min-h-14 items-start gap-3 px-4 py-3 no-underline transition-colors {selected
						? 'bg-ice-soft/50'
						: 'hover:bg-ice-soft/40'}"
					href="/equipes/{entry.id}"
					aria-current={selected ? 'page' : undefined}
				>
					<span class="w-[4.5rem] shrink-0 border-r border-line pr-2">
						<span class="block truncate text-caption font-medium uppercase tracking-wide text-muted">
							{formatWeekday(entry.gameDate)}
						</span>
						<time datetime={entry.gameDate} class="numeric mt-0.5 block whitespace-nowrap text-meta">
							{formatDate(entry.gameDate, 'short')}
						</time>
					</span>
					<span class="min-w-0 flex-1">
						<span class="block break-words text-body font-semibold">
							{formatTime(entry.startTime)} · {entry.location}
						</span>
						<span class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-meta">
							{#if entry.generated}
								{#each TEAMS as team (team.key)}
									<span class="inline-flex items-center gap-1.5 text-muted">
										<TeamMark team={team.key} short label />
										<span class="numeric text-ink">{entry.counts[team.key]}</span>
									</span>
								{/each}
								{#if entry.openSlots > 0}
									<span class={badgeClass('alert')}>{entry.openSlotsLabel}</span>
								{/if}
							{:else}
								<span class="badge">{t('games.notGenerated')}</span>
							{/if}
							{#if entry.status !== 'scheduled'}
								<span class={badgeClass(status.tone)}>{t(status.labelKey)}</span>
							{/if}
						</span>
					</span>
					<svg
						viewBox="0 0 24 24"
						class="mt-1 h-4 w-4 shrink-0 text-muted"
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
{/if}
