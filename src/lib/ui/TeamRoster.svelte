<script lang="ts">
	import { POSITIONS } from '#config/positions.ts';
	import { teamDefinition, type Team } from '#config/teams.ts';
	import type { GameSlotView } from '#lib/domain/games/types.ts';
	import { formatCount, t } from '#lib/shared/i18n/index.ts';
	import Avatar from '#lib/ui/Avatar.svelte';
	import PlayerName from '#lib/ui/PlayerName.svelte';
	import TeamMark from '#lib/ui/teams/TeamMark.svelte';

	let {
		slots,
		team,
		actorId = null,
		ownTeam = null,
		heading = true,
		peek = true,
		showCount = false
	}: {
		slots: readonly GameSlotView[];
		team: Team;
		actorId?: string | null;
		ownTeam?: Team | null;
		heading?: boolean;
		peek?: boolean;
		showCount?: boolean;
	} = $props();

	const definition = $derived(teamDefinition(team));
	const playerCount = $derived(
		slots.filter((slot) => slot.team === team && slot.player !== null).length
	);

	function slotsFor(position: string) {
		return slots.filter((slot) => slot.team === team && slot.position === position);
	}
</script>

{#if heading}
	<div
		class="flex items-center justify-between gap-2 border-t-[6px] px-3 py-2 {team === 'black'
			? 'border-team-black bg-surface'
			: 'border-team-white bg-surface'}"
	>
		<div class="flex min-w-0 items-center gap-2">
			<TeamMark {team} />
			<h3 class="text-base font-semibold">{t(definition.labelKey)}</h3>
			{#if showCount}
				<span class="text-meta text-muted">
					{formatCount(playerCount, 'common.playerCount.one', 'common.playerCount.many')}
				</span>
			{/if}
		</div>
		{#if ownTeam === team}
			<span class="stamp border-ice bg-ice-soft text-ice-deep">{t('home.team')}</span>
		{/if}
	</div>
{/if}

{#each POSITIONS as position (position.key)}
	{@const rows = slotsFor(position.key)}
	{#if rows.length > 0}
		<p class="micro-label mt-3 px-3 first:mt-2">{t(position.labelKey)}</p>
		<ul role="list">
			{#each rows as slot (slot.slotIndex)}
				{@const isMe = actorId !== null && slot.player?.playerId === actorId}
				<li class="ledger-row border-b border-line last:border-b-0" data-you={isMe}>
					<span class="jersey">{slot.player?.jerseyNumber ?? '-'}</span>
					{#if slot.player}
						<span class="flex min-w-0 items-center gap-2">
							<Avatar
								player={{
									fullName: slot.player.fullName,
									userId: slot.player.playerId,
									avatarId: slot.player.avatarId
								}}
								size={24}
							/>
							{#if peek}
								<PlayerName
									playerId={slot.player.playerId}
									name={slot.player.fullName}
									class="min-w-0 truncate text-body {isMe ? 'font-semibold' : ''}"
								/>
							{:else}
								<span class="min-w-0 truncate text-body {isMe ? 'font-semibold' : ''}">
									{slot.player.fullName}
								</span>
							{/if}
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
