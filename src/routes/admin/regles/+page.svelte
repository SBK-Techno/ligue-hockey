<script lang="ts">
	import { RULE_MODES, ruleModeDefinition, type RuleMode } from '#config/rule-modes.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const names = $derived(
		new Map(data.players.map((player) => [player.userId, player.fullName]))
	);
	let selectedMode = $state<RuleMode>('together');
	const selectedModeDefinition = $derived(ruleModeDefinition(selectedMode));
</script>

<PageHeader title={t('admin.rulesTitle')} meta={t('admin.rulesHelp')} />

<div class="page-stack">
	<FormFeedback {form} />

	<SectionCard title={t('admin.addRule')}>
		<form method="POST" action="?/create" use:progressiveForm class="grid gap-3 sm:grid-cols-3">
			<div>
				<label class="label" for="playerAId">{t('admin.rulePlayerA')}</label>
				<select class="input" id="playerAId" name="playerAId" required>
					<option value="">{t('admin.choosePlayer')}</option>
					{#each data.players as player (player.userId)}
						<option value={player.userId}>{player.fullName}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="label" for="playerBId">{t('admin.rulePlayerB')}</label>
				<select class="input" id="playerBId" name="playerBId" required>
					<option value="">{t('admin.choosePlayer')}</option>
					{#each data.players as player (player.userId)}
						<option value={player.userId}>{player.fullName}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="label" for="mode">{t('admin.ruleKind')}</label>
				<select
					class="input"
					id="mode"
					name="mode"
					value={selectedMode}
					onchange={(event) => (selectedMode = event.currentTarget.value as RuleMode)}
				>
					{#each RULE_MODES as mode (mode.key)}
						<option value={mode.key}>{t(mode.labelKey)}</option>
					{/each}
				</select>
				{#if selectedModeDefinition}
					<p class="hint">{t(selectedModeDefinition.descriptionKey)}</p>
				{/if}
			</div>
			<div class="sm:col-span-3">
				<button class="btn-primary btn-sm" type="submit">{t('admin.addRule')}</button>
			</div>
		</form>
	</SectionCard>

	{#if data.rules.length === 0}
		<EmptyState title={t('admin.rulesEmpty')}>
			{#snippet action()}
				<a class="btn-secondary" href="#playerAId">{t('admin.addRule')}</a>
			{/snippet}
		</EmptyState>
	{:else}
		<SectionCard flush>
			<ul role="list" class="divide-y divide-line">
				{#each data.rules as rule (rule.id)}
					{@const mode = ruleModeDefinition(rule.mode)}
					{@const pair = `${names.get(rule.playerAId) ?? t('admin.rulePlayerRemoved')} · ${names.get(rule.playerBId) ?? t('admin.rulePlayerRemoved')}`}
					<li class="section-row grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
						<div class="min-w-0">
							<p class="text-body font-semibold">
								{names.get(rule.playerAId) ?? t('admin.rulePlayerRemoved')}
								<span class="font-normal text-muted"> · </span>
								{names.get(rule.playerBId) ?? t('admin.rulePlayerRemoved')}
							</p>
							<p class="mt-1">
								<span class={badgeClass(mode?.tone)}>
									{mode ? t(mode.labelKey) : t('admin.ruleModeUnknown')}
								</span>
							</p>
						</div>
						<form method="POST" action="?/delete" use:progressiveForm>
							<input type="hidden" name="id" value={rule.id} />
							<ConfirmSubmit
								label={t('admin.deleteRule')}
								question={t('admin.deleteRuleConfirmNamed', { names: pair })}
								ariaLabel={t('admin.deleteRuleNamed', { names: pair })}
								class="btn-ghost btn-sm"
							/>
						</form>
					</li>
				{/each}
			</ul>
		</SectionCard>
	{/if}
</div>
