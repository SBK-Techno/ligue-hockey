<script lang="ts">
	import { RULE_MODES, ruleModeDefinition, type RuleMode } from '#config/rule-modes.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const names = $derived(
		new Map(data.players.map((player) => [player.userId, player.fullName]))
	);
	let selectedMode = $state<RuleMode>('together');
	const selectedModeDefinition = $derived(ruleModeDefinition(selectedMode));
	const badgeClass = {
		ok: 'badge-ok',
		alert: 'badge-alert',
		ice: 'badge-ice'
	} as const;
</script>

<FormFeedback {form} class="mb-4" />

<div class="mb-5">
	<h1>{t('admin.rulesTitle')}</h1>
	<p class="mt-1.5 text-sm text-muted">{t('admin.rulesHelp')}</p>
</div>

<section class="card mb-5">
	<h2 class="mb-3">{t('admin.addRule')}</h2>
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
</section>

{#if data.rules.length === 0}
	<div class="card">
		<p class="text-sm text-muted">{t('admin.rulesEmpty')}</p>
	</div>
{:else}
	<ul role="list" class="space-y-2">
		{#each data.rules as rule (rule.id)}
			{@const mode = ruleModeDefinition(rule.mode)}
			<li class="card flex flex-wrap items-center justify-between gap-3 py-3.5">
				<div class="min-w-0">
					<p class="text-sm font-semibold">
						{names.get(rule.playerAId) ?? rule.playerAId}
						<span class="font-normal text-muted"> · </span>
						{names.get(rule.playerBId) ?? rule.playerBId}
					</p>
					<p class="mt-1">
						<span class="badge {mode ? badgeClass[mode.tone] : 'badge'}">
							{mode ? t(mode.labelKey) : rule.mode}
						</span>
					</p>
				</div>
				<form method="POST" action="?/delete" use:progressiveForm>
					<input type="hidden" name="id" value={rule.id} />
					<ConfirmSubmit
						label={t('admin.deleteRule')}
						question={t('admin.deleteRuleConfirm')}
						class="btn-ghost btn-sm"
					/>
				</form>
			</li>
		{/each}
	</ul>
{/if}
