<script lang="ts">
	import {
		gameWarningDefinition,
		gameWarningLabelKey,
		gameWarningsInOrder
	} from '#config/game-warnings.ts';
	import { ruleModeDefinition, ruleModeFor } from '#config/rule-modes.ts';
	import type { LineupIntelligence } from '#lib/domain/games/alignment.ts';
	import type { GameView } from '#lib/domain/games/service.ts';
	import { formatDecimal, t } from '#lib/shared/i18n/index.ts';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	let {
		game,
		intelligence
	}: {
		game: GameView;
		intelligence: LineupIntelligence;
	} = $props();

	const generation = $derived(game.generation);
	const warnings = $derived(
		generation ? gameWarningsInOrder(generation.warnings) : []
	);
</script>

<!-- The button does the alignment: one click is enough. Manual adjustments
     stay on the ice, in the roster card below. -->
<SectionCard title={t('teams.managerTitle')}>
	{#snippet actions()}
		<form method="POST" action="?/generate" use:progressiveForm>
			<button class="btn-primary btn-sm" type="submit">{t('games.regenerate')}</button>
		</form>
	{/snippet}

	<div class="space-y-4">
		{#if intelligence.unratedNames.length > 0}
			<div class="alert">
				<p class="font-semibold">{t('games.ratingsMissing')}</p>
				<p class="mt-1 text-body">{intelligence.unratedNames.join(', ')}</p>
				<p class="mt-1 text-body">{t('teams.ratingsMissingHelp')}</p>
				<a class="link mt-1 inline-flex min-h-11 items-center text-body" href="/admin/evaluations">
					{t('games.ratingsMissingLink')}
				</a>
			</div>
		{/if}

		{#if !intelligence.complete}
			<div class="notice">
				<p class="font-semibold">{t('games.rosterIncomplete')}</p>
				<p class="mt-1 text-body leading-snug">{t('games.incomplete')}</p>
				<p class="mt-1 text-body">
					{t('games.sizeGap', { count: intelligence.sizeDiff })}
				</p>
			</div>
		{/if}

		{#if intelligence.swap}
			<div class="notice">
				<p class="font-semibold">{t('games.bestSwap')}</p>
				<p class="mt-1 text-body leading-snug">
					{t('games.bestSwapHelp', {
						a: intelligence.swap.nameA,
						b: intelligence.swap.nameB,
						before: formatDecimal(intelligence.swap.skillDiffBefore, 2),
						after: formatDecimal(intelligence.swap.skillDiffAfter, 2)
					})}
				</p>
				<p class="mt-1 text-body">
					{t('games.bestSwapAge', {
						before: formatDecimal(intelligence.swap.ageDiffBefore, 1),
						after: formatDecimal(intelligence.swap.ageDiffAfter, 1)
					})}
				</p>
				<form method="POST" action="?/swap" use:progressiveForm class="mt-2">
					<button class="btn-secondary btn-sm" type="submit">
						{t('games.applySwap')}
					</button>
				</form>
			</div>
		{/if}

		{#if intelligence.fills.count > 0}
			<div class="border-t border-line pt-3">
				<p class="text-body font-semibold">{t('games.fillSlots')}</p>
				<p class="hint mt-1">
					{intelligence.fills.names.join(', ')}
				</p>
				<form method="POST" action="?/fill" use:progressiveForm class="mt-2">
					<button class="btn-secondary btn-sm" type="submit">{t('games.fillSlots')}</button>
				</form>
			</div>
		{/if}

		{#if intelligence.complete && !intelligence.swap && intelligence.fills.count === 0}
			<p class="hint">{t('games.alreadyBalanced')}</p>
		{/if}

		{#if generation}
			{#each warnings as warning (warning)}
				{@const definition = gameWarningDefinition(warning)}
				<div class={definition.tone === 'alert' ? 'alert' : 'notice'}>
					<p class="font-semibold">{t(gameWarningLabelKey(warning))}</p>
					{#if definition.helpKey}
						<p class="mt-1">{t(definition.helpKey)}</p>
					{/if}
					{#if definition.detail === 'open-slots'}
						<p class="mt-1 text-body">{game.openSlotsLabel}</p>
					{/if}
				</div>
			{/each}

			{#if generation.ruleViolations.length > 0}
				<div class="notice">
					<p class="font-semibold">{t('admin.ruleViolations')}</p>
					<ul role="list" class="mt-2 space-y-1 text-body">
						{#each generation.ruleViolations as violation (violation.ruleId)}
							{@const mode = ruleModeDefinition(
								ruleModeFor(violation.kind, violation.strict)
							)}
							<li class="flex flex-wrap items-center gap-2">
								<span class={badgeClass(mode?.tone)}>
									{mode ? t(mode.shortLabelKey) : ''}
								</span>
								<span>{violation.names[0]} · {violation.names[1]}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</div>
</SectionCard>
