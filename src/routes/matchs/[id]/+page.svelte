<script lang="ts">
	import { enhance } from '$app/forms';
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { TEAMS } from '#config/teams.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const actor = $derived(data.actor.kind === 'user' ? data.actor : null);
	const game = $derived(data.game);
	const ownRequest = $derived(
		game && actor
			? data.requests.find((request) => request.requestedByPlayerId === actor.userId)
			: undefined
	);

	const statusKey = {
		scheduled: 'games.status.scheduled',
		cancelled: 'games.status.cancelled',
		completed: 'games.status.completed'
	} as const;

	function slotsFor(team: (typeof TEAMS)[number]['key'], position: string) {
		return game?.slots.filter(
			(slot) => slot.team === team && slot.position === position
		) ?? [];
	}
</script>

{#if form?.message}
	<p class="success mb-4">{form.message}</p>
{/if}

{#if !game}
	<div class="card">{t('games.noMatch')}</div>
{:else}
	<div class="mb-5 flex flex-wrap items-start justify-between gap-3">
		<div>
			<p class="font-display text-xs font-bold uppercase tracking-[0.2em] text-ice">
				{t(statusKey[game.status])}
			</p>
			<h1 class="mt-1">{formatDate(game.gameDate)}</h1>
			<p class="mt-1 text-sm text-muted">
				{formatTime(game.startTime)} · {game.location}
			</p>
		</div>
		{#if data.canManage}
			<a class="btn-secondary btn-sm" href="/admin/matchs/{game.id}">{t('games.adminEdit')}</a>
		{/if}
	</div>

	{#if game.notes}
		<div class="notice mb-4">{game.notes}</div>
	{/if}

	<section class="card mb-4">
		<div class="flex flex-wrap items-center gap-2">
			{#if data.availability}
				<span class="badge">{data.availability.summary}</span>
			{/if}
			{#if game.openSlots > 0}
				<span class="badge-alert">{game.openSlotsLabel}</span>
			{/if}
		</div>

		<div class="mt-4">
			{#if data.isSubstitute}
				<p class="hint">{t('availability.substituteHint')}</p>
			{:else if data.availability?.locked}
				<p class="badge">{t('availability.locked')}</p>
			{:else}
				<form method="POST" action="?/availability" use:enhance class="flex flex-wrap gap-2">
					<button
						class="btn {data.availability?.own === 'present' ? 'btn-primary' : 'btn-secondary'}"
						name="status"
						value="present"
						type="submit"
					>
						{t('availability.markPresent')}
					</button>
					<button
						class="btn {data.availability?.own === 'absent' ? 'btn-primary' : 'btn-secondary'}"
						name="status"
						value="absent"
						type="submit"
					>
						{t('availability.markAbsent')}
					</button>
				</form>
			{/if}
		</div>
	</section>

	<div class="grid gap-4 sm:grid-cols-2">
		{#each TEAMS as team (team.key)}
			<section class="card">
				<div class="flex items-center justify-between">
					<h2>{t(team.labelKey)}</h2>
					<span class="badge">{t(team.shortLabelKey)}</span>
				</div>
				{#each POSITIONS as position (position.key)}
					{@const rows = slotsFor(team.key, position.key)}
					{#if rows.length > 0}
						<h3 class="mt-4">{t(position.labelKey)}</h3>
						<ul class="mt-1 space-y-1">
							{#each rows as slot (slot.slotIndex)}
								<li class="flex min-h-9 items-center justify-between gap-2 rounded-lg bg-paper px-3 py-1.5 text-sm">
									{#if slot.player}
										<span class="font-medium">{slot.player.fullName}</span>
										{#if slot.player.kind === 'sub'}
											<span class="badge-ice">{t('games.substitutes')}</span>
										{/if}
									{:else}
										<span class="text-muted">{t('games.unassigned')}</span>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				{/each}
			</section>
		{/each}
	</div>

	{#if game.generation}
		<section class="card mt-4">
			<div class="section-title">
				<h2>{t('team.balance')}</h2>
				<span class="badge">{t('games.generated')}</span>
			</div>
			<p class="mt-2 text-sm text-muted">
				{t('games.teamBalance', {
					skill: game.generation.skillDiffLabel,
					age: game.generation.ageDiffLabel
				})}
			</p>
			{#if game.generation.warnings.includes('rule-conflict')}
				<div class="alert mt-3">
					<p class="font-semibold">{t('games.rulesConflict')}</p>
					<p class="mt-1">{t('games.rulesConflictHelp')}</p>
				</div>
			{/if}
			{#if game.generation.bench.length > 0}
				<h3 class="mt-4">{t('games.bench')}</h3>
				<ul class="mt-2 flex flex-wrap gap-2">
					{#each game.generation.bench as entry (entry.playerId)}
						<li class="badge">{entry.fullName} · {t(positionDefinition(entry.position).shortLabelKey)}</li>
					{/each}
				</ul>
			{/if}
			{#if data.canManage}
				<form method="POST" action="?/generate" use:enhance class="mt-4">
					<button class="btn-secondary btn-sm" type="submit">{t('games.regenerate')}</button>
				</form>
			{/if}
		</section>
	{:else if data.canManage}
		<section class="card mt-4">
			<p class="text-sm text-muted">{t('games.notGenerated')}</p>
			<form method="POST" action="?/generate" use:enhance class="mt-3">
				<button class="btn-primary" type="submit">{t('games.generate')}</button>
			</form>
		</section>
	{/if}

	<section class="card mt-4">
		<div class="section-title">
			<h2>{t('subs.title')}</h2>
		</div>
		{#if data.requests.length === 0}
			<p class="mt-2 text-sm text-muted">{t('subs.noneOpen')}</p>
		{:else}
			<ul class="mt-3 space-y-2">
				{#each data.requests as request (request.id)}
					<li class="rounded-xl border border-line bg-paper px-3 py-3">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div>
								<p class="text-sm font-semibold">{t(positionDefinition(request.position).labelKey)}</p>
								<p class="text-xs text-muted">
									{#if request.requestedByName}
										{request.requestedByName}
									{:else}
										{t('subs.openRequest')}
									{/if}
									{#if request.filledByName}
										· {t('subs.filledBy', { name: request.filledByName })}
									{/if}
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<span class="badge {request.status === 'filled' ? 'badge-ok' : 'badge-alert'}">
									{request.status === 'filled' ? t('subs.status.filled') : t('subs.openRequest')}
								</span>
								{#if request.status === 'open' && data.isSubstitute}
									<form method="POST" action="?/claim" use:enhance>
										<input type="hidden" name="requestId" value={request.id} />
										<button class="btn-primary btn-sm" type="submit">{t('subs.claim')}</button>
									</form>
								{/if}
								{#if request.status === 'filled' && actor && request.filledByPlayerId === actor.userId}
									<form method="POST" action="?/release" use:enhance>
										<input type="hidden" name="requestId" value={request.id} />
										<button class="btn-secondary btn-sm" type="submit">{t('subs.declined')}</button>
									</form>
								{/if}
								{#if data.canManage}
									<form method="POST" action="?/cancelRequest" use:enhance>
										<input type="hidden" name="requestId" value={request.id} />
										<button class="btn-ghost btn-sm" type="submit">{t('subs.cancelRequest')}</button>
									</form>
								{/if}
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
		{#if ownRequest}
			<p class="hint mt-3">{t('subs.yourRequests')} · {t(positionDefinition(ownRequest.position).labelKey)}</p>
		{/if}
		{#if data.canManage}
			<form method="POST" action="?/requestSub" use:enhance class="mt-4 flex flex-wrap items-end gap-2">
				<div class="min-w-40">
					<label class="label" for="position">{t('subs.choosePosition')}</label>
					<select class="input" id="position" name="position">
						{#each POSITIONS as position (position.key)}
							<option value={position.key}>{t(position.labelKey)}</option>
						{/each}
					</select>
				</div>
				<button class="btn-secondary" type="submit">{t('subs.add')}</button>
			</form>
		{/if}
	</section>
{/if}
