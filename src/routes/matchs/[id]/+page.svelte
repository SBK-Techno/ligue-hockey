<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import { mapUrlFor } from '#config/maps.ts';
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { can } from '#lib/domain/auth/policy.ts';
	import { teamDefinition } from '#config/teams.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import AvailabilityRoster from '#lib/ui/AvailabilityRoster.svelte';
	import { badgeClass } from '#lib/ui/badge-tone.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import MapLink from '#lib/ui/MapLink.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import GameSheet from '#lib/ui/match/GameSheet.svelte';
	import { matchSectionOrder } from '#lib/ui/match/match-layout.ts';
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
	const hasAttendance = $derived(
		Boolean(availability && availability.rows.length + availability.pending.length > 0)
	);
	const hasSubsPanel = $derived(data.requests.length > 0 || isManager);
	const filledRequests = $derived(
		data.requests.filter(
			(request) =>
				request.status === 'filled' ||
				(request.status === 'cancelled' && request.filledByPlayerId !== null)
		)
	);
	const completed = $derived(game?.status === 'completed');
	const showPresence = $derived(
		hasProfile && availability !== null && data.editable
	);
	const sectionOrder = $derived(
		game
			? matchSectionOrder({
					completed,
					hasAttendance,
					hasSubstitutes: completed ? data.requests.length > 0 : hasSubsPanel,
					hasSheet: Boolean(data.playable && data.sheet)
				})
			: []
	);
</script>

<FormFeedback {form} class="mb-4" />

{#if !game}
	<PageHeader
		title={t('games.noMatch')}
		back={{ href: '/matchs', label: t('games.title') }}
	/>
{:else}
	<PageHeader
		title={formatDate(game.gameDate)}
		meta="{formatTime(game.startTime)} · {game.location}"
		back={{ href: '/matchs', label: t('games.title') }}
	>
		{#snippet actions()}
			<span class={badgeClass(gameStatus(game.status).tone)}>{t(gameStatus(game.status).labelKey)}</span>
			{#if ownTeam}
				<a
					class="badge-ice inline-flex min-h-11 items-center no-underline"
					href="/equipes/{game.id}"
				>
					{t('home.team')} · {t(teamDefinition(ownTeam).labelKey)}
				</a>
			{:else}
				<a class="btn-secondary btn-sm" href="/equipes/{game.id}">{t('teams.view')}</a>
			{/if}
			{#if data.canManage && data.editable}
				<a class="btn-secondary btn-sm" href="/admin/matchs/{game.id}">{t('games.adminEdit')}</a>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="page-stack">
	{#if mapUrl}
		<p><MapLink href={mapUrl} /></p>
	{/if}

	{#if game.notes}
		<div class="notice whitespace-pre-wrap break-words">{game.notes}</div>
	{/if}

	{#if game.status === 'cancelled'}
		<div class="alert">
			<p class="font-semibold">{t('games.cancelledNotice')}</p>
		</div>
	{/if}

{#snippet presenceStrip()}
	{#if availability && (availability.substitute || availability.locked || availability.canRespond)}
		<section class="presence-strip" aria-labelledby="presence-titre">
			<div class="min-w-0">
				<p id="presence-titre" class="micro-label">{t('home.availability')}</p>
				{#if availability.substitute && data.editable}
					<p class="mt-1 text-body font-semibold">{t('availability.substituteHint')}</p>
				{:else if availability.locked}
					<p class="mt-1 text-body font-semibold">{t('availability.locked')}</p>
					{#if availability.canWithdraw}
						<p class="hint mt-1">{t('availability.lockedHelp')}</p>
					{/if}
				{:else if availability.canRespond}
					<p class="mt-1 text-body font-semibold">
						{#if availability.own === 'present'}
							{t('home.replyPresent')}
						{:else if availability.own === 'absent'}
							{t('home.replyAbsent')}
						{:else}
							{t('home.awaitingReply')}
						{/if}
					</p>
					<p class="mt-0.5 text-meta text-muted">
						{t('home.deadline', { date: availability.closesAtLabel })}
					</p>
				{/if}
				{#if ownRequest}
					<p class="hint mt-2">{t('subs.ownRequestOpen')}</p>
				{/if}
			</div>
			{#if availability.canRespond}
				<form
					method="POST"
					action="?/availability"
					use:progressiveForm
					class="presence-actions"
				>
					<button
						class="chip justify-center"
						name="status"
						value="present"
						type="submit"
						aria-pressed={availability.own === 'present'}
					>
						{t('availability.markPresent')}
					</button>
					<button
						class="chip justify-center"
						name="status"
						value="absent"
						type="submit"
						aria-pressed={availability.own === 'absent'}
					>
						{t('availability.markAbsent')}
					</button>
				</form>
			{:else if availability.locked && availability.canWithdraw}
				<form method="POST" action="?/availability" use:progressiveForm>
					<input type="hidden" name="gameId" value={game.id} />
					<input type="hidden" name="status" value="absent" />
					<ConfirmSubmit
						label={t('availability.withdraw')}
						question={t('availability.withdrawConfirm')}
						confirmLabel={t('availability.withdraw')}
						class="btn-secondary btn-sm"
					/>
				</form>
			{:else if availability.substitute && data.editable}
				<a class="btn-secondary btn-sm" href="/remplacants">{t('home.substituteCta')}</a>
			{/if}
		</section>
	{/if}
{/snippet}

{#snippet attendancePanel()}
	{#if hasAttendance && availability}
		<SectionCard
			class="self-start {hasSubsPanel ? 'lg:col-span-5' : 'lg:col-span-12'}"
			title={t('home.attendance')}
		>
			<AvailabilityRoster {availability} viewerId={actor?.userId ?? ''} />
		</SectionCard>
	{/if}
{/snippet}

{#snippet substitutesPanel()}
	{#if hasSubsPanel}
		<SectionCard
			class="self-start {hasAttendance ? 'lg:col-span-7' : 'lg:col-span-12'}"
			title={t('subs.title')}
			flush
		>
			<div class="section-row flex flex-wrap items-center justify-between gap-2 pb-0">
				<p class="hint">{t('subs.rules')}</p>
				{#if openRequests.length > 0}
					<span class="micro-label">{t('subs.openPositions')}</span>
				{/if}
			</div>

			{#if data.requests.length === 0}
				<p class="section-row text-body text-muted">{t('subs.noneOpen')}</p>
			{:else}
				<ul role="list" class="mt-2 divide-y divide-line border-t border-line">
					{#each openRequests as request (request.id)}
						<li class="section-row">
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
									<span class={request.status === 'filled' ? 'badge-ok' : 'badge-ice'}>
										{request.status === 'filled' ? t('subs.status.filled') : t('subs.placeOpen')}
									</span>
									{#if request.status === 'open' && data.isSubstitute && data.editable}
										{#if data.positions.includes(request.position)}
											<form method="POST" action="?/claim" use:progressiveForm>
												<input type="hidden" name="requestId" value={request.id} />
												<button class="btn-primary btn-sm" type="submit">{t('subs.claim')}</button>
											</form>
										{:else}
											<span class="badge">{t('subs.positionNotSelected')}</span>
										{/if}
									{/if}
									{#if request.status === 'filled' && data.editable && actor && request.filledByPlayerId === actor.userId}
										<form method="POST" action="?/release" use:progressiveForm>
											<input type="hidden" name="requestId" value={request.id} />
											<button class="btn-secondary btn-sm" type="submit">{t('subs.release')}</button>
										</form>
									{/if}
									{#if data.canManage && data.editable && request.status === 'open'}
										<form method="POST" action="?/cancelRequest" use:progressiveForm>
											<input type="hidden" name="requestId" value={request.id} />
											<ConfirmSubmit
												label={t('subs.cancelRequest')}
												question={t('subs.cancelRequestConfirm')}
												confirmLabel={t('subs.cancelRequest')}
											/>
										</form>
									{/if}
								</div>
							</div>
						</li>
					{/each}
				</ul>
				{#if filledRequests.length > 0}
					<details class="group border-t border-line">
						<summary
							class="link section-row flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-body marker:content-none"
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
						<ul role="list" class="divide-y divide-line border-t border-line">
							{#each filledRequests as request (request.id)}
								<li class="section-row">
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
											{#if data.editable && actor && request.filledByPlayerId === actor.userId}
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

			{#if data.canManage && data.editable}
				<form
					method="POST"
					action="?/requestSub"
					use:progressiveForm
					class="section-body flex flex-wrap items-end gap-2 border-t border-line"
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
		</SectionCard>
	{/if}

{/snippet}

{#snippet sheetPanel()}
	{#if data.playable && data.sheet}
		<SectionCard class="lg:col-span-12" title={t('gamesheet.title')} clip={false}>
			<GameSheet
				sheet={data.sheet}
				slots={game.slots}
				canManage={isManager}
				completed={data.sheet.finalized}
			/>
		</SectionCard>
	{/if}

{/snippet}

	{#if showPresence}
		{@render presenceStrip()}
	{/if}

	<div class="board-grid">
{#each sectionOrder as section (section)}
		{#if section === 'attendance'}
			{@render attendancePanel()}
		{:else if section === 'substitutes'}
			{@render substitutesPanel()}
		{:else if section === 'sheet'}
			{@render sheetPanel()}
		{/if}
	{/each}
	</div>
	</div>
{/if}
