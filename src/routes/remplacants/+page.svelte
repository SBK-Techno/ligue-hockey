<script lang="ts">
	import { enhance } from '$app/forms';
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

{#if form?.message}
	<p class="success mb-4">{form.message}</p>
{/if}

<div class="mb-6">
	<h1>{t('subs.title')}</h1>
	<p class="mt-1 text-sm text-muted">{t('subs.subtitle')}</p>
</div>

{#if !data.isSubstitute}
	<div class="notice mb-5">{t('subs.notInPool')}</div>
{/if}

<section class="card mb-5">
	<h2>{t('subs.positions')}</h2>
	<p class="mt-1 text-sm text-muted">{t('subs.positionsHelp')}</p>
	<form method="POST" action="?/saveProfile" use:enhance class="mt-4">
		<div class="flex flex-wrap gap-2">
			{#each POSITIONS as position (position.key)}
				<label
					class="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium has-[:checked]:border-ice has-[:checked]:bg-ice-soft"
				>
					<input
						type="checkbox"
						name="positions"
						value={position.key}
						checked={data.positions.includes(position.key)}
						class="h-4 w-4 accent-[var(--color-ice)]"
					/>
					{t(position.labelKey)}
				</label>
			{/each}
		</div>
		<button class="btn-secondary btn-sm mt-4" type="submit">{t('common.save')}</button>
	</form>
</section>

<section class="mb-5">
	<div class="section-title mb-3">
		<h2>{t('subs.openRequest')}</h2>
		<span class="badge">{data.requests.length}</span>
	</div>
	{#if data.requests.length === 0}
		<div class="card text-sm text-muted">{t('subs.noneOpen')}</div>
	{:else}
		<ul class="space-y-3">
			{#each data.requests as request (request.id)}
				<li class="card">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p class="font-semibold">{t(positionDefinition(request.position).labelKey)}</p>
							<p class="mt-1 text-sm text-muted">
								{formatDate(request.game.gameDate)} · {formatTime(request.game.startTime)} ·
								{request.game.location}
							</p>
							{#if request.requestedByName}
								<p class="hint">{request.requestedByName}</p>
							{/if}
						</div>
						{#if data.isSubstitute && data.positions.includes(request.position)}
							<form method="POST" action="?/claim" use:enhance>
								<input type="hidden" name="gameId" value={request.gameId} />
								<input type="hidden" name="requestId" value={request.id} />
								<button class="btn-primary btn-sm" type="submit">{t('subs.claim')}</button>
							</form>
						{:else}
							<span class="badge">{t('subs.notEligible')}</span>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section>
	<div class="section-title mb-3">
		<h2>{t('subs.substituteList')}</h2>
		<span class="badge">{data.pool.length}</span>
	</div>
	<div class="card-flush overflow-hidden">
		<ul class="divide-y divide-line/70">
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
</section>
