<script lang="ts">
	import {
		gameWarningDefinition,
		gameWarningLabelKey,
		gameWarningsInOrder
	} from '#config/game-warnings.ts';
	import { TEAMS, teamDefinition } from '#config/teams.ts';
	import { ruleModeDefinition, ruleModeFor } from '#config/rule-modes.ts';
	import type { LineupIntelligence } from '#lib/domain/games/alignment.ts';
	import type { GameView } from '#lib/domain/games/service.ts';
	import { formatDecimal, formatTimestamp, t } from '#lib/shared/i18n/index.ts';
	import { balanceLine } from '#lib/ui/game-balance.ts';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
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
	const balance = $derived(
		generation ? balanceLine(generation.skillDiffLabel, generation.ageDiffLabel) : ''
	);
	const warnings = $derived(
		generation ? gameWarningsInOrder(generation.warnings) : []
	);
</script>

<SectionCard title={t('teams.managerTitle')}>
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="min-w-0 space-y-2">
			{#if !game.lineupComplete}
				<span class="badge-alert">{game.openSlotsLabel}</span>
			{/if}
			{#if generation}
				<p class="text-meta text-muted">
					{t('games.publishedAt', { date: formatTimestamp(generation.generatedAt) })}
				</p>
			{/if}
			{#if balance}
				<p class="text-body text-muted">{balance}</p>
			{/if}
			<div class="flex flex-wrap gap-x-4 gap-y-1 text-body text-muted">
				{#each TEAMS as team (team.key)}
					<p>
						{t('games.teamSize', {
							team: t(teamDefinition(team.key).labelKey),
							count: intelligence.sizes[team.key]
						})}
					</p>
				{/each}
			</div>
			<p class="hint">{t('teams.managerHelp')}</p>
		</div>

		<div class="flex flex-wrap gap-2">
			<form method="POST" action="?/generate" use:progressiveForm>
				<ConfirmSubmit
					label={t('games.regenerate')}
					question={t('games.regenerateConfirm')}
					confirmLabel={t('games.regenerate')}
					class="btn-secondary btn-sm"
				/>
			</form>
		</div>
	</div>

	{#if intelligence.unratedNames.length > 0}
		<div class="alert mt-4">
			<p class="font-semibold">{t('games.ratingsMissing')}</p>
			<p class="mt-1 text-body">{intelligence.unratedNames.join(', ')}</p>
			<p class="mt-1 text-body">{t('teams.ratingsMissingHelp')}</p>
			<a class="link mt-1 inline-flex min-h-11 items-center text-body" href="/admin/evaluations">
				{t('games.ratingsMissingLink')}
			</a>
		</div>
	{/if}

	{#if !intelligence.complete}
		<div class="notice mt-4">
			<p class="font-semibold">{t('games.rosterIncomplete')}</p>
			<p class="mt-1 text-body leading-snug">{t('games.incomplete')}</p>
			<p class="mt-1 text-body">
				{t('games.sizeGap', { count: intelligence.sizeDiff })}
			</p>
		</div>
	{/if}

	{#if intelligence.swap}
		<div class="notice mt-4">
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
				<ConfirmSubmit
					label={t('games.applySwap')}
					title={t('games.bestSwap')}
					question={t('games.swapConfirm', {
						a: intelligence.swap.nameA,
						b: intelligence.swap.nameB,
						before: formatDecimal(intelligence.swap.skillDiffBefore, 2),
						after: formatDecimal(intelligence.swap.skillDiffAfter, 2),
						ageBefore: formatDecimal(intelligence.swap.ageDiffBefore, 1),
						ageAfter: formatDecimal(intelligence.swap.ageDiffAfter, 1)
					})}
					confirmLabel={t('games.applySwap')}
					cancelLabel={t('common.cancel')}
					tone="neutral"
					class="btn-secondary btn-sm"
				/>
			</form>
		</div>
	{/if}

	{#if intelligence.fills.count > 0}
		<div class="mt-4 border-t border-line pt-3">
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
		<p class="hint mt-4">{t('games.alreadyBalanced')}</p>
	{/if}

	{#if generation}
		{#each warnings as warning (warning)}
			{@const definition = gameWarningDefinition(warning)}
			<div class={definition.tone === 'alert' ? 'alert mt-4' : 'notice mt-4'}>
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
			<div class="notice mt-4">
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
</SectionCard>
