<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import { gameWarningDefinition } from '#config/game-warnings.ts';
	import { mapUrlFor } from '#config/maps.ts';
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { ruleModeDefinition, ruleModeFor } from '#config/rule-modes.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { teamDefinition } from '#config/teams.ts';
	import { formatDate, formatTime, formatTimestamp, t } from '#lib/shared/i18n/index.ts';
	import AvailabilityRoster from '#lib/ui/AvailabilityRoster.svelte';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import TeamLineup from '#lib/ui/TeamLineup.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const actor = $derived(data.actor.kind === 'user' ? data.actor : null);
	const game = $derived(data.game);
	const availability = $derived(data.availability);
	const hasProfile = $derived(data.hasPlayerProfile);
	const isManager = $derived(actor !== null && can(actor, 'manageGames'));
	const mapUrl = $derived(
		game ? mapUrlFor(game.locationAddress, game.locationMapUrl) : null
	);
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
						request.requestedByPlayerId === actor.userId && request.status === 'open'
				)
			: undefined
	);
	const openRequests = $derived(data.requests.filter((request) => request.status === 'open'));
	const filledRequests = $derived(
		data.requests.filter((request) => request.status === 'filled')
	);
</script>

<FormFeedback {form} class="mb-4" />

{#if !game}
	<PageHeader
		title={t('games.noMatch')}
		back={{ href: '/matchs', label: t('games.title') }}
	/>
	<a class="btn-secondary" href="/matchs">{t('common.back')}</a>
{:else}
	<PageHeader
		title={formatDate(game.gameDate)}
		meta="{formatTime(game.startTime)} · {game.location}"
		back={{ href: '/matchs', label: t('games.title') }}
	>
		{#snippet actions()}
			<span class={badgeClass(gameStatus(game.status).tone)}>{t(gameStatus(game.status).labelKey)}</span>
			{#if ownTeam}
				<span class="badge-ice">
					{t('home.team')} · {t(teamDefinition(ownTeam).labelKey)}
				</span>
			{/if}
			{#if data.canManage}
				<a class="btn-secondary btn-sm" href="/admin/matchs/{game.id}">{t('games.adminEdit')}</a>
			{/if}
		{/snippet}
	</PageHeader>

	{#if mapUrl}
		<p class="-mt-3 mb-4">
			<a
				class="link inline-flex items-center gap-1 text-body"
				href={mapUrl}
				target="_blank"
				rel="noreferrer"
			>
				{t('games.openMap')}
				<svg
					viewBox="0 0 24 24"
					class="h-3.5 w-3.5"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path d="M14 5h5v5M19 5l-8 8M18 13v6H5V6h6" />
				</svg>
			</a>
		</p>
	{/if}

	{#if game.notes}
		<div class="notice mb-4 whitespace-pre-wrap break-words">{game.notes}</div>
	{/if}

	{#if game.status === 'cancelled'}
		<div class="alert mb-4">
			<p class="font-semibold">{t('games.cancelledNotice')}</p>
		</div>
	{/if}

	<section class="card">
		<h2>{hasProfile ? t('home.availability') : t('availability.title')}</h2>

		{#if game.status === 'cancelled'}
			<p class="mt-2 text-body text-muted">{t('games.cancelledNotice')}</p>
		{:else if isManager && !hasProfile}
			<p class="mt-3 text-body text-muted">{t('home.adminHero')}</p>
		{:else if availability?.substitute}
			<p class="mt-3 text-body text-muted">{t('availability.substituteHint')}</p>
			<a class="btn-secondary btn-sm mt-3" href="/remplacants">{t('home.substituteCta')}</a>
		{:else if availability?.locked}
			<p class="mt-3 text-body font-medium text-muted">{t('availability.locked')}</p>
			{#if availability.canWithdraw}
				<p class="hint mt-1">{t('availability.lockedHelp')}</p>
				<form method="POST" action="?/availability" use:progressiveForm class="mt-3">
					<input type="hidden" name="gameId" value={game.id} />
					<input type="hidden" name="status" value="absent" />
					<ConfirmSubmit
						label={t('availability.withdraw')}
						question={t('availability.withdrawConfirm')}
						confirmLabel={t('availability.withdraw')}
						class="btn-secondary btn-sm"
					/>
				</form>
			{/if}
		{:else if availability?.canRespond}
			<div class="mt-4 flex flex-wrap items-center justify-between gap-4">
				<div>
					<p class="text-body font-semibold">
						{#if availability.own === 'present'}
							{t('home.replyPresent')}
						{:else if availability.own === 'absent'}
							{t('home.replyAbsent')}
						{:else}
							{t('home.awaitingReply')}
						{/if}
					</p>
					<p class="mt-1 text-meta text-muted">
						{t('home.deadline', { date: availability.closesAtLabel })}
					</p>
				</div>
				<form
					method="POST"
					action="?/availability"
					use:progressiveForm
					class="grid w-full grid-cols-2 gap-2 sm:inline-flex sm:w-auto sm:rounded-control sm:border sm:border-line-strong sm:bg-paper sm:p-1"
				>
					<button
						class="min-h-11 rounded-control border px-4 text-body font-semibold transition-colors sm:border-0 {availability.own ===
						'present'
							? 'border-ink bg-ink text-paper'
							: 'border-line-strong bg-surface text-ink hover:bg-paper sm:bg-transparent sm:text-muted sm:hover:bg-ink/5 sm:hover:text-ink'}"
						name="status"
						value="present"
						type="submit"
						aria-pressed={availability.own === 'present'}
					>
						{t('availability.markPresent')}
					</button>
					<button
						class="min-h-11 rounded-control border px-4 text-body font-semibold transition-colors sm:border-0 {availability.own ===
						'absent'
							? 'border-ink bg-ink text-paper'
							: 'border-line-strong bg-surface text-ink hover:bg-paper sm:bg-transparent sm:text-muted sm:hover:bg-ink/5 sm:hover:text-ink'}"
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

	</section>

	{#if availability && availability.rows.length + availability.pending.length > 0}
		<section class="card mt-4">
			<h2>{t('home.attendance')}</h2>
			<div class="mt-3">
				<AvailabilityRoster {availability} viewerId={actor?.userId ?? ''} />
			</div>
		</section>
	{/if}

	{#if data.requests.length > 0 || isManager}
		<section class="card mt-4">
			<div class="section-title">
				<h2>{t('subs.title')}</h2>
				{#if openRequests.length > 0}
					<span class="micro-label">{t('subs.openPositions')}</span>
				{/if}
			</div>
			<p class="hint mt-1">{t('subs.rules')}</p>

			{#if data.requests.length === 0}
				<p class="mt-3 text-body text-muted">{t('subs.noneOpen')}</p>
			{:else}
				<ul role="list" class="mt-3 space-y-2">
					{#each openRequests as request (request.id)}
						<li
							class="relative rounded-control border border-line bg-paper px-3 py-3 pl-4"
						>
							<span
								aria-hidden="true"
								class="absolute inset-y-2 left-0 w-0.5 rounded-full {request.status ===
								'open'
									? 'bg-ice'
									: 'bg-ok'}"
							></span>
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="min-w-0">
									<p class="text-body font-semibold">
										{t(positionDefinition(request.position).labelKey)}
									</p>
									<p class="mt-0.5 text-meta text-muted">
										{#if request.requestedByName}
											{t('subs.requestedBy', { name: request.requestedByName })}
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
				{#if filledRequests.length > 0}
					<details class="group mt-3 border-t border-line/70 pt-1">
						<summary
							class="link flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-body marker:content-none"
						>
							<svg
								viewBox="0 0 24 24"
								class="h-3.5 w-3.5 transition-transform group-open:rotate-90"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								aria-hidden="true"
							>
								<path d="m9 6 6 6-6 6" />
							</svg>
							{t('subs.filledHistory', { count: filledRequests.length })}
						</summary>
						<ul role="list" class="mt-1 space-y-2">
							{#each filledRequests as request (request.id)}
								<li class="rounded-control border border-line bg-paper px-3 py-2.5">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div class="min-w-0">
											<p class="text-body font-semibold">
												{t(positionDefinition(request.position).labelKey)}
											</p>
											<p class="mt-0.5 text-meta text-muted">
												{#if request.filledByName}
													{t('subs.filledBy', { name: request.filledByName })}
												{:else if request.requestedByName}
													{t('subs.requestedBy', { name: request.requestedByName })}
												{:else}
													{t('subs.placeOpen')}
												{/if}
											</p>
										</div>
										<div class="flex flex-wrap items-center gap-2">
											<span class="badge-ok">{t('subs.status.filled')}</span>
											{#if actor && request.filledByPlayerId === actor.userId}
												<form method="POST" action="?/release" use:progressiveForm>
													<input type="hidden" name="requestId" value={request.id} />
													<button class="btn-secondary btn-sm" type="submit">{t('subs.release')}</button>
												</form>
											{/if}
										</div>
									</div>
								</li>
							{/each}
						</ul>
					</details>
				{/if}
			{/if}

			{#if data.canManage}
				<form
					method="POST"
					action="?/requestSub"
					use:progressiveForm
					class="mt-5 flex flex-wrap items-end gap-2 border-t border-line/80 pt-4"
				>
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

	{#if game.generated}
		<section class="mt-6">
			<div class="flex flex-wrap items-baseline justify-between gap-3">
				<div>
					<h2>{t('games.roster')}</h2>
					{#if game.generation}
						<p class="mt-1 text-meta text-muted">
							{t('games.publishedAt', { date: formatTimestamp(game.generation.generatedAt) })}
						</p>
					{/if}
				</div>
				<span class="badge-ok">{t('games.generated')}</span>
			</div>

			<TeamLineup slots={game.slots} ownTeam={ownTeam} actorId={actor?.userId ?? null} />
		</section>

		{#if game.generation && data.canManage}
			<section class="card mt-6">
				<div class="section-title">
					<h2>{t('team.balance')}</h2>
				</div>
				<p class="mt-2 text-body text-muted">
					{t('games.teamBalance', {
						skill: game.generation.skillDiffLabel ?? '',
						age: game.generation.ageDiffLabel ?? ''
					})}
				</p>
				{#each game.generation.warnings as warning (warning)}
					{@const definition = gameWarningDefinition(warning)}
					{#if !definition.managerOnly || data.canManage}
						<div class={definition.tone === 'alert' ? 'alert mt-3' : 'notice mt-3'}>
							<p class="font-semibold">{t(definition.labelKey)}</p>
							{#if definition.helpKey}
								<p class="mt-1">
									{t(
										data.canManage || !definition.playerHelpKey
											? definition.helpKey
											: definition.playerHelpKey
									)}
								</p>
							{/if}
							{#if definition.detail === 'open-slots'}
								<p class="mt-1 text-body">{game.openSlotsLabel}</p>
							{/if}
						</div>
					{/if}
				{/each}
				{#if data.canManage && game.generation.ruleViolations.length > 0}
					<div class="notice mt-3">
						<p class="font-semibold">{t('admin.ruleViolations')}</p>
						<ul role="list" class="mt-2 space-y-1 text-body">
							{#each game.generation.ruleViolations as violation (violation.ruleId)}
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
				{#if game.generation.bench.length > 0}
					<p class="micro-label mt-4">{t('games.bench')}</p>
					<ul role="list" class="mt-2 flex flex-wrap gap-2">
						{#each game.generation.bench as entry (entry.playerId)}
							<li class="badge">
								{#if entry.jerseyNumber}<span class="numeric">{entry.jerseyNumber}</span>{/if}
								{entry.fullName} · {t(positionDefinition(entry.position).shortLabelKey)}
							</li>
						{/each}
					</ul>
				{/if}
				{#if data.canManage && data.editable}
					<form method="POST" action="?/generate" use:progressiveForm class="mt-4">
						<button class="btn-secondary btn-sm" type="submit">{t('games.regenerate')}</button>
					</form>
				{/if}
			</section>
		{/if}
	{:else}
		<section class="card mt-6">
			<h2>{t('games.notGenerated')}</h2>
			<p class="measure mt-2 text-body text-muted">
				{data.canManage ? t('games.lineupSoonAdmin') : t('games.lineupSoon')}
			</p>
			{#if data.canManage && data.editable}
				<form method="POST" action="?/generate" use:progressiveForm class="mt-4">
					<button class="btn-primary" type="submit">{t('games.generate')}</button>
				</form>
			{/if}
		</section>
	{/if}
{/if}
