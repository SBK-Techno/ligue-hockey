<script lang="ts">
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const isManager = $derived(data.actor.kind === 'user' && can(data.actor, 'manageSubs'));
	const poolHref = $derived(
		data.actor.kind === 'user' && can(data.actor, 'managePlayers')
			? '/admin/joueurs'
			: '/admin/matchs'
	);
</script>

<FormFeedback {form} class="mb-4" />

<div class="mb-6">
	<h1>{t('subs.title')}</h1>
	<p class="mt-1.5 text-sm text-muted">{t('subs.subtitle')}</p>
</div>

{#if isManager}
	<div class="notice mb-5">
		<p>{t('subs.adminNotice')}</p>
		<a class="btn-secondary btn-sm mt-3" href={poolHref}>{t('subs.managePool')}</a>
	</div>
{/if}
{#if !data.isSubstitute && !isManager}
	<div class="notice mb-5">
		<p>{t('subs.notInPool')}</p>
		<p class="mt-1 text-ice-deep/80">{t('subs.notInPoolHelp')}</p>
	</div>
{/if}

{#if data.isSubstitute}
	<section class="card mb-5" id="positions">
		<h2>{t('subs.positions')}</h2>
		<p class="mt-1 text-sm text-muted">{t('subs.positionsHelp')}</p>
		<form method="POST" action="?/saveProfile" use:progressiveForm class="mt-4">
			<fieldset>
				<legend class="sr-only">{t('subs.positions')}</legend>
				<div class="flex flex-wrap gap-2">
					{#each POSITIONS as position (position.key)}
						<label
							class="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line bg-paper px-3 py-2 text-sm font-medium transition-colors has-[:checked]:border-ice has-[:checked]:bg-ice-soft"
						>
							<input
								type="checkbox"
								name="positions"
								value={position.key}
								checked={data.positions.includes(position.key)}
								class="h-4 w-4"
							/>
							{t(position.labelKey)}
						</label>
					{/each}
				</div>
			</fieldset>
			<button class="btn-secondary btn-sm mt-4" type="submit">{t('common.save')}</button>
		</form>
	</section>
{/if}

<section class="mb-6">
	<div class="section-title mb-3">
		<h2>{t('subs.openPositions')}</h2>
		<span class="badge">{data.requests.length}</span>
	</div>
	{#if data.requests.length === 0}
		<div class="card">
			<p class="text-sm text-muted">{t('subs.noneOpen')}</p>
			<p class="hint">{isManager ? t('home.adminOpenSlots') : t('subs.emptyHelp')}</p>
			{#if isManager}
				<a class="btn-secondary btn-sm mt-3" href="/admin/matchs">{t('home.openRequest')}</a>
			{/if}
		</div>
	{:else}
		<ul role="list" class="space-y-2.5">
			{#each data.requests as request (request.id)}
				<li class="card">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="font-semibold text-ink">
								{t(positionDefinition(request.position).labelKey)}
							</p>
							<p class="mt-1 text-sm text-muted">
								{formatDate(request.game.gameDate)} · {formatTime(request.game.startTime)} ·
								{request.game.location}
							</p>
							{#if request.requestedByName}
								<p class="hint">{t('subs.requestedBy', { name: request.requestedByName })}</p>
							{/if}
						</div>
						<div class="flex flex-wrap items-center gap-2">
							{#if data.isSubstitute && data.positions.includes(request.position)}
								<form method="POST" action="?/claim" use:progressiveForm>
									<input type="hidden" name="gameId" value={request.gameId} />
									<input type="hidden" name="requestId" value={request.id} />
									<button class="btn-primary btn-sm" type="submit">{t('subs.claim')}</button>
								</form>
							{:else if data.isSubstitute}
								<span class="badge">{t('subs.positionNotSelected')}</span>
							{/if}
							<a class="link text-sm" href="/matchs/{request.gameId}">{t('subs.viewGame')}</a>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section>
	<div class="mb-3">
		<div class="section-title">
			<h2>{t('subs.substituteList')}</h2>
			<span class="badge">{data.pool.length}</span>
		</div>
		{#if isManager}
			<p class="hint">{t('subs.favoriteHelp')}</p>
		{/if}
	</div>
	{#if data.pool.length === 0}
		<div class="card text-sm text-muted">{t('subs.poolEmpty')}</div>
	{:else}
		<div class="card-flush overflow-hidden">
			<ul role="list" class="divide-y divide-line/70">
				{#each data.pool as substitute (substitute.playerId)}
					<li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
						<span class="text-sm font-medium">{substitute.fullName}</span>
						<span class="flex flex-wrap gap-1">
							{#each substitute.positions as position (position)}
								<span class="badge">{t(positionDefinition(position).shortLabelKey)}</span>
							{/each}
							{#if substitute.favorite}
								<span class="badge-ice">{t('subs.favorite')}</span>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>
