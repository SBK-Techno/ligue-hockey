<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import { formatDate, formatTime, formatWeekday, t } from '#lib/shared/i18n/index.ts';
	import { badgeClass, type BadgeTone } from '#lib/ui/badge-tone.ts';

	export type GameRowBadge = { label: string; tone?: BadgeTone };

	let {
		game,
		context = 'public',
		past = false,
		next = false,
		href
	}: {
		game: {
			id: string;
			gameDate: string;
			startTime: string;
			location: string;
			status: string;
			generated?: boolean;
			openSlots?: number;
			openSlotsLabel?: string;
		};
		context?: 'public' | 'admin';
		past?: boolean;
		next?: boolean;
		href?: string;
	} = $props();

	/**
	 * Un match, un jeu de badges. Le contexte décide de ce qui est utile :
	 * un joueur voit l'état du match, un responsable voit aussi ce qui reste à faire.
	 */
	const badges = $derived.by<GameRowBadge[]>(() => {
		const list: GameRowBadge[] = [];
		if (next) list.push({ label: t('games.next'), tone: 'ice' });

		const status = gameStatus(game.status);
		if (game.status !== 'scheduled') {
			list.push({ label: t(status.labelKey), tone: status.tone });
		}

		if (context === 'admin' && !past && game.status !== 'cancelled') {
			if (game.generated) {
				list.push({ label: t('games.generated'), tone: 'ice' });
				if ((game.openSlots ?? 0) > 0 && game.openSlotsLabel) {
					list.push({ label: game.openSlotsLabel, tone: 'alert' });
				}
			} else {
				list.push({ label: t('games.notGenerated'), tone: 'neutral' });
			}
		}

		return list;
	});
</script>

<a
	class="flex min-h-14 items-center gap-2 focus-visible:outline-offset-[-2px] px-4 py-2 no-underline transition-colors hover:bg-ice-soft/60"
	href={href ?? `/matchs/${game.id}`}
	aria-current={next ? 'true' : undefined}
>
	<span class="w-[4.5rem] shrink-0 border-r border-line pr-2">
		<span class="block truncate text-caption font-medium uppercase tracking-wide text-muted">
			{formatWeekday(game.gameDate)}
		</span>
		<time datetime={game.gameDate} class="numeric mt-0.5 block whitespace-nowrap text-meta">
			{formatDate(game.gameDate, 'short')}
		</time>
		{#if past}
			<span class="numeric block text-stamp text-muted">{game.gameDate.slice(0, 4)}</span>
		{/if}
	</span>
	<span class="min-w-0 flex-1">
		<span class="block truncate text-body font-semibold">
			{formatTime(game.startTime)} · {game.location}
		</span>
		{#if badges.length > 0}
			<span class="mt-1 flex flex-wrap items-center gap-1">
				{#each badges as badge (badge.label)}
					<span class={badgeClass(badge.tone)}>{badge.label}</span>
				{/each}
			</span>
		{/if}
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
