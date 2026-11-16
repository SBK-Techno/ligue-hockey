<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const names = $derived(
		new Map(data.players.map((player) => [player.userId, player.fullName]))
	);
</script>

{#if form?.message}
	<p class="success mb-4">{form.message}</p>
{/if}

<div class="mb-4">
	<h2>{t('admin.rulesTitle')}</h2>
	<p class="mt-1 text-sm text-muted">{t('admin.rulesHelp')}</p>
</div>

<section class="card mb-5">
	<h3 class="mb-3">{t('admin.addRule')}</h3>
	<form method="POST" action="?/create" use:enhance class="grid gap-3 sm:grid-cols-3">
		<div>
			<label class="label" for="playerAId">{t('admin.rulePlayerA')}</label>
			<select class="input" id="playerAId" name="playerAId" required>
				{#each data.players as player (player.userId)}
					<option value={player.userId}>{player.fullName}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="label" for="playerBId">{t('admin.rulePlayerB')}</label>
			<select class="input" id="playerBId" name="playerBId" required>
				{#each data.players as player (player.userId)}
					<option value={player.userId}>{player.fullName}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="label" for="kind">{t('admin.ruleKind')}</label>
			<select class="input" id="kind" name="kind">
				<option value="must">{t('admin.ruleMust')}</option>
				<option value="must_not">{t('admin.ruleMustNot')}</option>
			</select>
		</div>
		<div class="sm:col-span-3">
			<button class="btn-primary btn-sm" type="submit">{t('admin.addRule')}</button>
		</div>
	</form>
</section>

{#if data.rules.length === 0}
	<div class="card text-sm text-muted">{t('common.none')}</div>
{:else}
	<ul class="space-y-2">
		{#each data.rules as rule (rule.id)}
			<li class="card flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="text-sm font-semibold">
						{names.get(rule.playerAId) ?? rule.playerAId}
						{rule.kind === 'must' ? ' + ' : ' ≠ '}
						{names.get(rule.playerBId) ?? rule.playerBId}
					</p>
					<p class="text-xs text-muted">
						{rule.kind === 'must' ? t('admin.ruleMust') : t('admin.ruleMustNot')}
					</p>
				</div>
				<form method="POST" action="?/delete" use:enhance>
					<input type="hidden" name="id" value={rule.id} />
					<button class="btn-ghost btn-sm" type="submit">{t('admin.deleteRule')}</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
