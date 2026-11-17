<script lang="ts">
	import { orderedTeams, type Team } from '#config/teams.ts';
	import type { GamePlayer, GameSlotView } from '#lib/domain/games/types.ts';
	import TeamBench from '#lib/ui/teams/TeamBench.svelte';
	import TeamRoster from '#lib/ui/TeamRoster.svelte';

	let {
		slots,
		bench = [],
		ownTeam = null,
		actorId = null
	}: {
		slots: readonly GameSlotView[];
		bench?: readonly GamePlayer[];
		ownTeam?: Team | null;
		actorId?: string | null;
	} = $props();
</script>

<div class="grid gap-4 sm:grid-cols-2">
	{#each orderedTeams(ownTeam) as team (team.key)}
		<div class="card-flush min-w-0 overflow-hidden">
			<TeamRoster {slots} team={team.key} {actorId} {ownTeam} showCount />
		</div>
	{/each}
</div>

<TeamBench {bench} {actorId} />
