<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
	import { ruleModeDefinition, ruleModeFor } from '#config/rule-modes.ts';
	import { teamDefinition } from '#config/teams.ts';
	import type { GameView } from '#lib/domain/games/service.ts';
	import type { GameBenchView, GameSlotView } from '#lib/domain/games/types.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import SectionCard from '#lib/ui/SectionCard.svelte';

	let {
		game,
		ownSlot,
		ownBench,
		actorId
	}: {
		game: GameView;
		ownSlot: GameSlotView | null;
		ownBench: GameBenchView | null;
		actorId: string;
	} = $props();

	const team = $derived(ownSlot ? teamDefinition(ownSlot.team) : null);
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
	{#if ownSlot && team && position}
			<div class="flex items-start gap-3">
				<span class="jersey min-h-10 min-w-10 text-base">{jersey ?? '-'}</span>
				<div class="min-w-0">
					<span
						class="badge {ownSlot.team === 'black'
							? 'border-team-black bg-team-black text-team-white'
							: 'border-line-strong bg-team-white text-team-black'}"
					>
						{t(team.labelKey)}
					</span>
					<p class="mt-1.5 text-body font-semibold">{t(position.labelKey)}</p>
				</div>
			</div>
			{#if pairNote}
				<p class="notice mt-3 text-meta leading-relaxed">{pairNote}</p>
			{/if}
		{:else if ownBench}
			<p class="text-body font-semibold">{t('home.teamBench')}</p>
			<p class="hint">{t('home.teamBenchHelp')}</p>
		{:else}
			<p class="text-body font-semibold">{t('home.teamNoSlot')}</p>
			<p class="hint">{t('home.teamNoSlotHelp')}</p>
		{/if}
</SectionCard>
