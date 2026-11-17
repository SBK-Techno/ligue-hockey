<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
	import type { GamePlayer } from '#lib/domain/games/types.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import Avatar from '#lib/ui/Avatar.svelte';
	import PlayerName from '#lib/ui/PlayerName.svelte';

	let {
		bench,
		actorId = null
	}: {
		bench: readonly GamePlayer[];
		actorId?: string | null;
	} = $props();
</script>

{#if bench.length > 0}
	<div class="border-t border-line px-3 py-3">
		<h3 class="text-base font-semibold">{t('rink.bench')}</h3>
		<ul role="list" class="mt-2 flex flex-wrap gap-1.5">
			{#each bench as player (player.playerId)}
				{@const isMe = actorId !== null && actorId === player.playerId}
				<li class="chip flex items-center gap-1.5" data-you={isMe}>
					<Avatar
						player={{
							fullName: player.fullName,
							userId: player.playerId,
							avatarId: player.avatarId
						}}
						size={24}
					/>
					<span class="font-mono text-caption text-muted">{player.jerseyNumber ?? '?'}</span>
					<PlayerName
						playerId={player.playerId}
						name={player.fullName}
						class="text-body {isMe ? 'font-semibold' : ''}"
					/>
					<span class="text-caption text-muted">
						{t(positionDefinition(player.position).shortLabelKey)}
					</span>
					{#if isMe}
						<span class="stamp border-ice bg-ice-soft text-ice-deep">{t('common.you')}</span>
					{:else if player.kind === 'sub'}
						<span class="badge">{t('games.substitutes')}</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}
