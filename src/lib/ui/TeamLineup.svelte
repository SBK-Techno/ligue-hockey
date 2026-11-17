<script lang="ts">
	import { TEAMS, type Team } from '#config/teams.ts';
	import type { GameSlotView } from '#lib/domain/games/types.ts';
	import TeamRoster from '#lib/ui/TeamRoster.svelte';

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
</script>

<div class="mt-4 grid gap-4 sm:grid-cols-2">
	{#each orderedTeams as team (team.key)}
		<div class="card-flush min-w-0 overflow-hidden">
			<TeamRoster {slots} team={team.key} {actorId} {ownTeam} />
		</div>
	{/each}
</div>
