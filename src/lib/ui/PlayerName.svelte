<script lang="ts">
	/**
	 * A player name that opens the shared peek. Used where a bare name has no
	 * avatar next to it, so phone users get the same access as a mouse hover.
	 */
	let {
		playerId,
		name,
		class: className = ''
	}: {
		playerId: string;
		name: string;
		class?: string;
	} = $props();
</script>

{#if playerId}
	<button
		type="button"
		class="player-name {className}"
		data-player-id={playerId}
		data-player-peek="click"
		aria-haspopup="dialog"
	>
		{name}
	</button>
{:else}
	<span class="{className}">{name}</span>
{/if}
