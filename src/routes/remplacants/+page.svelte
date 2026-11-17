<script lang="ts">
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import InvitePlayerForm from '#lib/ui/InvitePlayerForm.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import PositionChips from '#lib/ui/PositionChips.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const actor = $derived(data.actor.kind === 'user' ? data.actor : null);
	let showInvite = $state(false);
	let showRequest = $state(false);

	const hasRequestableGames = $derived(data.games.length > 0);
</script>

<PageHeader title={t('subs.title')} meta={t('subs.subtitle')} />

<div class="page-stack">
	<FormFeedback {form} />

	{#if !data.isSubstitute && !data.canManageRequests}
		<div class="notice">
			<p>{t('subs.notInPool')}</p>
		</div>
	{/if}

	{#if data.isSubstitute}
		<SectionCard title={t('subs.positions')}>
			<p class="hint">{t('subs.positionsHelp')}</p>
			<form method="POST" action="?/saveProfile" use:progressiveForm class="mt-4 space-y-4">
				<PositionChips name="positions" selected={data.positions} legend={t('subs.positions')} />
				<button class="btn-primary" type="submit">{t('common.save')}</button>
			</form>
		</SectionCard>
	{/if}

	<SectionCard title="{t('subs.openPositions')} ({data.requests.length})" flush>
		{#if data.canManageRequests && data.requests.length > 0 && hasRequestableGames}
			<div class="section-row flex justify-end border-b border-line">
				<button
					class="btn-secondary btn-sm"
					type="button"
					onclick={() => (showRequest = !showRequest)}
					aria-expanded={showRequest}
					aria-controls="request-form"
				>
					{showRequest ? t('common.close') : t('subs.openRequest')}
				</button>
			</div>
		{/if}

		{#if data.canManageRequests && showRequest && hasRequestableGames}
			<form
				id="request-form"
				method="POST"
				action="?/request"
				use:progressiveForm={{ onSuccess: () => (showRequest = false) }}
				class="section-body grid gap-4 border-b border-line sm:grid-cols-2"
			>
				<div class="sm:col-span-2">
					<label class="label" for="request-game">{t('subs.requestGame')}</label>
					<select class="input" id="request-game" name="gameId" required>
						<option value="">{t('subs.chooseGame')}</option>
						{#each data.games as game (game.id)}
							<option value={game.id}>
								{formatDate(game.gameDate)} · {formatTime(game.startTime)} · {game.location}
							</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="label" for="request-position">{t('subs.choosePosition')}</label>
					<select class="input" id="request-position" name="position" required>
						{#each POSITIONS as position (position.key)}
							<option value={position.key}>{t(position.labelKey)}</option>
						{/each}
					</select>
				</div>
				<div class="flex items-end">
					<button class="btn-primary" type="submit">{t('subs.openRequest')}</button>
				</div>
			</form>
		{/if}

		{#if data.requests.length === 0}
			<div class="section-body">
				<EmptyState
					title={t('subs.noneOpen')}
					help={data.canManageRequests
						? hasRequestableGames
							? t('subs.requestEmptyManager')
							: t('subs.requestNeedsGame')
						: t('subs.requestEmptyPlayer')}
				>
					{#snippet action()}
						{#if data.canManageRequests && hasRequestableGames}
							<button
								class="btn-secondary btn-sm"
								type="button"
								onclick={() => (showRequest = !showRequest)}
								aria-expanded={showRequest}
								aria-controls="request-form"
							>
								{showRequest ? t('common.close') : t('subs.openRequest')}
							</button>
						{:else if data.canManageRequests && data.canManageGames}
							<a class="btn-secondary btn-sm" href="/admin/matchs">{t('home.createGame')}</a>
						{/if}
					{/snippet}
				</EmptyState>
			</div>
		{:else}
			<ul role="list" class="divide-y divide-line">
				{#each data.requests as request (request.id)}
					<li class="section-row">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="text-body font-semibold text-ink">
									{t(positionDefinition(request.position).labelKey)}
								</p>
								<p class="mt-0.5 text-meta text-muted">
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
								{#if data.canManageRequests}
									<form method="POST" action="?/cancel" use:progressiveForm>
										<input type="hidden" name="gameId" value={request.gameId} />
										<input type="hidden" name="requestId" value={request.id} />
										<ConfirmSubmit
											label={t('subs.cancelRequest')}
											question={t('subs.cancelRequestConfirm')}
											class="btn-ghost btn-sm"
										/>
									</form>
								{:else if actor && request.requestedByPlayerId === actor.userId}
									<form method="POST" action="?/cancelOwn" use:progressiveForm>
										<input type="hidden" name="gameId" value={request.gameId} />
										<input type="hidden" name="requestId" value={request.id} />
										<ConfirmSubmit
											label={t('subs.cancelRequest')}
											question={t('subs.cancelRequestConfirm')}
											class="btn-ghost btn-sm"
										/>
									</form>
								{/if}
								<a class="link text-body" href="/matchs/{request.gameId}">{t('subs.viewGame')}</a>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</SectionCard>

	{#if data.canManageRequests}
		<SectionCard title="{t('subs.substituteList')} ({data.pool.length})" flush>
			<div class="section-row flex flex-wrap items-center justify-between gap-2 border-b border-line">
				<p class="hint">{t('subs.favoriteHelp')}</p>
				{#if data.canManagePool && data.pool.length > 0}
					<button
						class="btn-secondary btn-sm"
						type="button"
						onclick={() => (showInvite = !showInvite)}
						aria-expanded={showInvite}
						aria-controls="invite-form"
					>
						{showInvite ? t('common.close') : t('subs.addSubstitute')}
					</button>
				{/if}
			</div>

			{#if data.canManagePool && showInvite}
				<div id="invite-form" class="section-body border-b border-line">
					<h3 class="mb-3 text-subhead">{t('subs.addSubstitute')}</h3>
					<InvitePlayerForm
						action="?/inviteSubstitute"
						substitute
						submitLabel={t('subs.inviteSubstitute')}
						onSuccess={() => (showInvite = false)}
					/>
				</div>
			{/if}

			{#if data.pool.length === 0}
				<div class="section-body">
					<EmptyState
						title={t('subs.poolEmpty')}
						help={data.canManagePool ? t('subs.poolEmptyHelp') : undefined}
					>
						{#snippet action()}
							{#if data.canManagePool}
								<button
									class="btn-secondary btn-sm"
									type="button"
									onclick={() => (showInvite = !showInvite)}
									aria-expanded={showInvite}
									aria-controls="invite-form"
								>
									{showInvite ? t('common.close') : t('subs.addSubstitute')}
								</button>
							{/if}
						{/snippet}
					</EmptyState>
				</div>
			{:else}
				<ul role="list" class="divide-y divide-line">
					{#each data.pool as substitute (substitute.playerId)}
						<li class="section-row">
							<div class="flex flex-wrap items-start justify-between gap-2">
								<span class="min-w-0 text-body font-medium">{substitute.fullName}</span>
								<span class="flex flex-wrap gap-1">
									{#each substitute.positions as position (position)}
										<span class="badge">{t(positionDefinition(position).shortLabelKey)}</span>
									{/each}
									{#if substitute.favorite}
										<span class="badge-ice">{t('subs.favorite')}</span>
									{/if}
								</span>
							</div>
							{#if data.canManagePool}
								<div class="mt-2 flex flex-wrap items-center gap-1">
									<form method="POST" action="?/favorite" use:progressiveForm>
										<input type="hidden" name="playerId" value={substitute.playerId} />
										<input
											type="hidden"
											name="favorite"
											value={substitute.favorite ? 'false' : 'true'}
										/>
										<button class="btn-ghost btn-sm" type="submit">
											{substitute.favorite ? t('subs.removeFavorite') : t('subs.addFavorite')}
										</button>
									</form>
									<form method="POST" action="?/removeSubstitute" use:progressiveForm>
										<input type="hidden" name="playerId" value={substitute.playerId} />
										<ConfirmSubmit
											label={t('admin.removeSub')}
											question={t('subs.removeSubstituteConfirm', {
												name: substitute.fullName
											})}
										/>
									</form>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</SectionCard>
	{/if}
</div>
