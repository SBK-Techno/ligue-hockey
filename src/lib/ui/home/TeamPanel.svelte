<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
	import { ruleModeDefinition, ruleModeFor } from '#config/rule-modes.ts';
	import type { GameView } from '#lib/domain/games/service.ts';
	import type { GamePlayer, GameSlotView } from '#lib/domain/games/types.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import TeamMark from '#lib/ui/teams/TeamMark.svelte';

	let {
		game,
		ownSlot,
		ownBench,
		actorId
	}: {
		game: GameView;
		ownSlot: GameSlotView | null;
		ownBench: GamePlayer | null;
		actorId: string;
	} = $props();

	const jersey = $derived(ownSlot?.player?.jerseyNumber ?? null);
	const position = $derived(ownSlot ? positionDefinition(ownSlot.position) : null);
	const violation = $derived(
		game.generation?.ruleViolations.find((entry) => entry.playerIds.includes(actorId)) ?? null
	);
	const pairNote = $derived.by(() => {
		if (!violation || !ownSlot?.player) return null;
		const mode = ruleModeDefinition(ruleModeFor(violation.kind, violation.strict));
		if (!mode) return null;
		const otherName =
			violation.names.find((name) => name !== ownSlot.player?.fullName) ?? violation.names[1];
		return t('home.teamRuleNote', { rule: t(mode.shortLabelKey), name: otherName });
	});
</script>

<SectionCard title={t('home.team')}>
	{#if ownSlot && position}
			<div class="flex items-start gap-3">
				<span class="jersey min-h-10 min-w-10 text-base">{jersey ?? '-'}</span>
				<div class="min-w-0">
					<TeamMark team={ownSlot.team} variant="badge" />
					<p class="mt-1.5 text-body font-semibold">{t(position.labelKey)}</p>
				</div>
			</div>
			{#if pairNote}
				<p class="notice mt-3 text-meta leading-relaxed">{pairNote}</p>
			{/if}
		{:else if ownBench}
			{#if ownBench.team}
				<TeamMark team={ownBench.team} variant="badge" />
			{/if}
			<p class="text-body font-semibold {ownBench.team ? 'mt-1.5' : ''}">{t('home.teamBench')}</p>
			<p class="hint">{t('home.teamBenchHelp')}</p>
		{:else}
			<p class="text-body font-semibold">{t('home.teamNoSlot')}</p>
			<p class="hint">{t('home.teamNoSlotHelp')}</p>
		{/if}
	<a class="link mt-3 inline-flex min-h-11 items-center text-body" href="/equipes/{game.id}">
		{t('teams.view')}
	</a>
</SectionCard>
