<script lang="ts">
	import type { I18nKey } from '#config/i18n/fr.ts';
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { ruleModeDefinition, ruleModeFor } from '#config/rule-modes.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { TEAMS, teamDefinition } from '#config/teams.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import AvailabilityRoster from '#lib/ui/AvailabilityRoster.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const actor = $derived(data.actor.kind === 'user' ? data.actor : null);
	const game = $derived(data.game);
	const availability = $derived(data.availability);
	const hasProfile = $derived(data.hasPlayerProfile);
	const isManager = $derived(actor !== null && can(actor, 'manageGames'));
	const ownSlot = $derived(
		game && actor
			? game.slots.find((slot) => slot.player?.playerId === actor.userId)
			: undefined
	);
	const ownTeam = $derived(ownSlot?.team ?? null);
	const ownRequest = $derived(
		game && actor
			? data.requests.find(
					(request) =>
						request.requestedByPlayerId === actor.userId &&
						request.status === 'open'
				)
			: undefined
	);
	const openRequests = $derived(data.requests.filter((request) => request.status === 'open'));
	const filledRequests = $derived(
		data.requests.filter((request) => request.status === 'filled')
	);
	const badgeClass = {
		ok: 'badge-ok',
		alert: 'badge-alert',
		ice: 'badge-ice'
	} as const;
	const orderedTeams = $derived(
		ownTeam
			? [...TEAMS].sort((a, b) =>
					a.key === ownTeam ? -1 : b.key === ownTeam ? 1 : 0
				)
			: [...TEAMS]
	);

	const statusKey: Record<string, I18nKey> = {
		scheduled: 'games.status.scheduled',
		cancelled: 'games.status.cancelled',
		completed: 'games.status.completed'
	};

	function slotsFor(team: (typeof TEAMS)[number]['key'], position: string) {
		return (
			game?.slots.filter(
				(slot) => slot.team === team && slot.position === position
			) ?? []
		);
	}
</script>

<FormFeedback {form} class="mb-4" />

{#if !game}
	<div class="card">
		<h1>{t('games.noMatch')}</h1>
		<a class="btn-secondary mt-4" href="/matchs">{t('common.back')}</a>
	</div>
{:else}
	<div class="mb-5 flex flex-wrap items-start justify-between gap-3">
		<div>
			<a class="link text-sm" href="/matchs">← {t('games.title')}</a>
			<h1 class="mt-2 first-letter:uppercase">{formatDate(game.gameDate)}</h1>
			<p class="mt-1.5 text-sm text-muted">
				{formatTime(game.startTime)} · {game.location}
			</p>
			<div class="mt-2 flex flex-wrap items-center gap-2">
				<span class="badge {game.status === 'cancelled' ? 'badge-alert' : ''}">
					{t(statusKey[game.status] ?? 'games.status.scheduled')}
				</span>
				{#if ownTeam}
					<span class="badge-ice">{t('home.team')} · {t(teamDefinition(ownTeam).labelKey)}</span>
				{/if}
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if data.canManage}
				<a class="btn-secondary btn-sm" href="/admin/matchs/{game.id}">{t('games.adminEdit')}</a>
			{/if}
		</div>
	</div>

	{#if game.notes}
		<div class="notice mb-4 whitespace-pre-wrap break-words">{game.notes}</div>
	{/if}

	{#if game.status === 'cancelled'}
		<div class="alert mb-4">
			<p class="font-semibold">{t('games.cancelledNotice')}</p>
		</div>
	{/if}

	<section class="card mb-4">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2>{hasProfile ? t('home.availability') : t('home.attendance')}</h2>
			{#if availability}
				<span class="text-sm text-muted">{availability.summary}</span>
			{/if}
		</div>

		{#if game.status === 'cancelled'}
			<p class="mt-3 text-sm text-muted">{t('games.cancelledNotice')}</p>
		{:else if isManager && !hasProfile}
			<p class="mt-3 text-sm text-muted">{t('home.adminHero')}</p>
		{:else if availability?.substitute}
			<p class="mt-3 text-sm text-muted">{t('availability.substituteHint')}</p>
			<a class="btn-secondary btn-sm mt-3" href="/remplacants">{t('home.substituteCta')}</a>
		{:else if availability?.locked}
			<p class="mt-3 text-sm font-medium text-muted">{t('availability.locked')}</p>
		{:else if availability?.canRespond}
			<div class="mt-4 flex flex-wrap items-center justify-between gap-4">
				<div>
					<p class="text-sm font-semibold">
						{#if availability.own === 'present'}
							{t('home.replyPresent')}
						{:else if availability.own === 'absent'}
							{t('home.replyAbsent')}
						{:else}
							{t('home.awaitingReply')}
						{/if}
					</p>
					<p class="mt-1 text-xs text-muted">
						{t('home.deadline', { date: availability.closesAtLabel })}
					</p>
				</div>
				<form
					method="POST"
					action="?/availability"
					use:progressiveForm
					class="inline-flex rounded-xl border border-line bg-paper p-1"
				>
					<button
						class="min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors {availability.own ===
						'present'
							? 'bg-ice text-white'
							: 'text-muted hover:bg-ink/5 hover:text-ink'}"
						name="status"
						value="present"
						type="submit"
						aria-pressed={availability.own === 'present'}
					>
						{t('availability.markPresent')}
					</button>
					<button
						class="min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors {availability.own ===
						'absent'
							? 'bg-ink text-paper'
							: 'text-muted hover:bg-ink/5 hover:text-ink'}"
						name="status"
						value="absent"
						type="submit"
						aria-pressed={availability.own === 'absent'}
					>
						{t('availability.markAbsent')}
					</button>
				</form>
			</div>
			{#if ownRequest}
				<p class="hint mt-3">{t('subs.ownRequestOpen')}</p>
			{/if}
		{/if}

		{#if availability && availability.rows.length + availability.pending.length > 0}
			<div class="mt-5 border-t border-line/80 pt-5">
				<AvailabilityRoster {availability} viewerId={actor?.userId ?? ''} />
			</div>
		{/if}
	</section>

	<section class="card mb-4">
		<div class="section-title">
			<h2>{t('subs.title')}</h2>
		</div>
		<p class="hint mt-1">{t('subs.rules')}</p>

		{#if data.requests.length === 0}
			<p class="mt-3 text-sm text-muted">{t('subs.noneOpen')}</p>
		{:else}
			<ul role="list" class="mt-4 space-y-2">
				{#each [...openRequests, ...filledRequests] as request (request.id)}
					<li class="rounded-control border border-line bg-paper/60 px-3 py-3">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="min-w-0">
								<p class="text-sm font-semibold">
									{t(positionDefinition(request.position).labelKey)}
								</p>
								<p class="mt-0.5 text-xs text-muted">
									{#if request.status === 'filled' && request.filledByName}
										{t('subs.filledBy', { name: request.filledByName })}
									{:else if request.requestedByName}
										{t('subs.requestedBy', { name: request.requestedByName })}
									{:else}
										{t('subs.placeOpen')}
									{/if}
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<span class="badge {request.status === 'filled' ? 'badge-ok' : 'badge-ice'}">
									{request.status === 'filled' ? t('subs.status.filled') : t('subs.placeOpen')}
								</span>
								{#if request.status === 'open' && data.isSubstitute}
									{#if data.positions.includes(request.position)}
										<form method="POST" action="?/claim" use:progressiveForm>
											<input type="hidden" name="requestId" value={request.id} />
											<button class="btn-primary btn-sm" type="submit">{t('subs.claim')}</button>
										</form>
									{:else}
										<span class="badge">{t('subs.positionNotSelected')}</span>
									{/if}
								{/if}
								{#if request.status === 'filled' && actor && request.filledByPlayerId === actor.userId}
									<form method="POST" action="?/release" use:progressiveForm>
										<input type="hidden" name="requestId" value={request.id} />
										<button class="btn-secondary btn-sm" type="submit">{t('subs.release')}</button>
									</form>
								{/if}
								{#if data.canManage && request.status === 'open'}
									<form method="POST" action="?/cancelRequest" use:progressiveForm>
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

		{#if data.canManage}
			<form method="POST" action="?/requestSub" use:progressiveForm class="mt-5 flex flex-wrap items-end gap-2 border-t border-line/80 pt-4">
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

	{#if game.generated}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each orderedTeams as team (team.key)}
				<section class="card">
					<div class="flex items-center justify-between gap-2">
						<div class="flex items-center gap-2.5">
							<span
								class="h-3 w-3 rounded-full border {team.tone === 'black'
									? 'border-ink bg-ink'
									: 'border-ink/30 bg-paper'}"
							></span>
							<h2>{t(team.labelKey)}</h2>
						</div>
						{#if ownTeam === team.key}
							<span class="badge-ice">{t('home.team')}</span>
						{/if}
					</div>
					{#each POSITIONS as position (position.key)}
						{@const rows = slotsFor(team.key, position.key)}
						{#if rows.length > 0}
							<h3 class="mt-4 text-xs font-semibold text-muted">
								{t(position.labelKey)}
							</h3>
							<ul role="list" class="mt-1.5 space-y-1">
								{#each rows as slot (slot.slotIndex)}
									<li
										class="flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm {slot.player &&
										slot.player.playerId === actor?.userId
											? 'bg-ice-soft font-semibold text-ice-deep'
											: 'bg-paper'}"
									>
										{#if slot.player}
											<span class="flex min-w-0 items-center gap-2">
												{#if slot.player.jerseyNumber}
													<span class="data text-xs text-muted">#{slot.player.jerseyNumber}</span>
												{/if}
												<span class="truncate">{slot.player.fullName}</span>
											</span>
											{#if slot.player.playerId === actor?.userId}
												<span class="text-[10px] font-bold">{t('common.you')}</span>
											{:else if slot.player.kind === 'sub'}
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
				{#if data.canManage}
					<p class="mt-2 text-sm text-muted">
						{t('games.teamBalance', {
							skill: game.generation.skillDiffLabel ?? '',
							age: game.generation.ageDiffLabel ?? ''
						})}
					</p>
				{:else}
					<p class="mt-2 text-sm text-muted">{t('games.balanceNote')}</p>
				{/if}
				{#if data.canManage && game.generation.warnings.includes('rule-limit')}
					<div class="alert mt-3">
						<p class="font-semibold">{t('games.limitConflict')}</p>
						<p class="mt-1">{t('games.limitConflictHelp')}</p>
					</div>
				{/if}
				{#if game.generation.warnings.includes('rule-conflict')}
					<div class="notice mt-3">
						<p class="font-semibold">{t('games.rulesConflict')}</p>
						<p class="mt-1">
							{data.canManage
								? t('games.rulesConflictHelp')
								: t('games.rulesConflictPlayer')}
						</p>
					</div>
				{/if}
				{#if data.canManage && game.generation.ruleViolations.length > 0}
					<div class="notice mt-3">
						<p class="font-semibold">{t('admin.ruleViolations')}</p>
						<ul role="list" class="mt-2 space-y-1 text-sm">
							{#each game.generation.ruleViolations as violation (violation.ruleId)}
								{@const mode = ruleModeDefinition(
									ruleModeFor(violation.kind, violation.strict)
								)}
								<li class="flex flex-wrap items-center gap-2">
									<span class="badge {mode ? badgeClass[mode.tone] : ''}">
										{mode ? t(mode.shortLabelKey) : ''}
									</span>
									<span>
										{violation.names[0]} · {violation.names[1]}
									</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
				{#if game.generation.bench.length > 0}
					<h3 class="mt-4 text-xs font-semibold text-muted">{t('games.bench')}</h3>
					<ul role="list" class="mt-2 flex flex-wrap gap-2">
						{#each game.generation.bench as entry (entry.playerId)}
							<li class="badge">
								{#if entry.jerseyNumber}<span class="data">#{entry.jerseyNumber}</span>{/if}
								{entry.fullName} · {t(positionDefinition(entry.position).shortLabelKey)}
							</li>
						{/each}
					</ul>
				{/if}
				{#if data.canManage}
					<form method="POST" action="?/generate" use:progressiveForm class="mt-4">
						<button class="btn-secondary btn-sm" type="submit">{t('games.regenerate')}</button>
					</form>
				{/if}
			</section>
		{/if}
	{:else}
		<section class="card">
			<h2>{t('games.notGenerated')}</h2>
			<p class="mt-2 text-sm text-muted">
				{data.canManage ? t('games.lineupSoonAdmin') : t('games.lineupSoon')}
			</p>
			{#if data.canManage}
				<form method="POST" action="?/generate" use:progressiveForm class="mt-4">
					<button class="btn-primary" type="submit">{t('games.generate')}</button>
				</form>
			{/if}
		</section>
	{/if}
{/if}
