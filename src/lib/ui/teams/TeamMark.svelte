<script lang="ts">
	import { teamDefinition, type Team } from '#config/teams.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		team,
		variant = 'dot',
		size = 'md',
		label = false,
		short = false,
		class: className = ''
	}: {
		team: Team;
		variant?: 'dot' | 'badge';
		size?: 'sm' | 'md';
		label?: boolean;
		short?: boolean;
		class?: string;
	} = $props();

	const definition = $derived(teamDefinition(team));
	const labelKey = $derived(short ? definition.shortLabelKey : definition.labelKey);
	const dotClass = $derived(
		team === 'black' ? 'bg-team-black' : 'border border-line-strong bg-team-white'
	);
	const badgeClass = $derived(
		team === 'black'
			? 'border-team-black bg-team-black text-team-white'
			: 'border-line-strong bg-team-white text-team-black'
	);
	const dotSize = $derived(size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3');
</script>

{#if variant === 'dot'}
	<span
		aria-hidden="true"
		class="{dotSize} shrink-0 rounded-full {dotClass} {className}"
	></span>
	{#if label}
		<span class="truncate">{t(labelKey)}</span>
	{/if}
{:else}
	<span class="badge {badgeClass} {className}">{t(labelKey)}</span>
{/if}
