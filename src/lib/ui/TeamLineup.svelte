<script lang="ts">
	import { POSITIONS } from '#config/positions.ts';
	import { TEAMS, type Team } from '#config/teams.ts';
	import type { GameSlotView } from '#lib/domain/games/types.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		slots,
		ownTeam = null,
		actorId = null
	}: {
		slots: readonly GameSlotView[];
		ownTeam?: Team | null;
		actorId?: string | null;
	} = $props();

	const orderedTeams = $derived(
		ownTeam
			? [...TEAMS].sort((a, b) => (a.key === ownTeam ? -1 : b.key === ownTeam ? 1 : 0))
			: [...TEAMS]
	);

	function slotsFor(team: Team, position: string) {
		return slots.filter((slot) => slot.team === team && slot.position === position);
	}
</script>

<div class="mt-4 grid gap-4 sm:grid-cols-2">
	{#each orderedTeams as team (team.key)}
		<div class="card-flush min-w-0 overflow-hidden">
			<div
				class="flex items-center justify-between gap-2 border-t-[6px] px-3 py-2 {team.key ===
				'black'
					? 'border-team-black bg-surface'
					: 'border-team-white bg-surface'}"
			>
				<div class="flex min-w-0 items-center gap-2">
					<span
						aria-hidden="true"
						class="h-3 w-3 shrink-0 rounded-full {team.key === 'black'
							? 'bg-team-black'
							: 'border border-line-strong bg-team-white'}"
					></span>
					<h3 class="text-base font-semibold">{t(team.labelKey)}</h3>
				</div>
				{#if ownTeam === team.key}
					<span class="stamp border-ice bg-ice-soft text-ice-deep">{t('home.team')}</span>
				{/if}
			</div>

			{#each POSITIONS as position (position.key)}
				{@const rows = slotsFor(team.key, position.key)}
				{#if rows.length > 0}
					<p class="micro-label mt-3 px-3 first:mt-2">{t(position.labelKey)}</p>
					<ul role="list">
						{#each rows as slot (slot.slotIndex)}
							{@const isMe = actorId !== null && slot.player?.playerId === actorId}
							<li class="ledger-row border-b border-line last:border-b-0" data-you={isMe}>
								<span class="jersey">{slot.player?.jerseyNumber ?? '-'}</span>
								{#if slot.player}
									<span class="min-w-0 truncate text-body {isMe ? 'font-semibold' : ''}">
										{slot.player.fullName}
									</span>
									{#if isMe}
										<span class="stamp border-ice bg-ice-soft text-ice-deep">{t('common.you')}</span>
									{:else if slot.player.kind === 'sub'}
										<span class="badge shrink-0">{t('games.substitutes')}</span>
									{:else}
										<span></span>
									{/if}
								{:else}
									<span class="min-w-0 truncate text-body text-muted">{t('games.unassigned')}</span>
									<span></span>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			{/each}
		</div>
	{/each}
</div>
