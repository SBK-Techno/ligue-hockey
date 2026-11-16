<script lang="ts">
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import InvitePlayerForm from '#lib/ui/InvitePlayerForm.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let showInvite = $state(false);
	let showRequest = $state(false);

	const hasRequestableGames = $derived(data.games.length > 0);
</script>

<FormFeedback {form} class="mb-4" />

<PageHeader title={t('subs.title')} meta={t('subs.subtitle')} />

{#if !data.isSubstitute && !data.canManageRequests}
	<div class="notice mb-5">
		<p>{t('subs.notInPool')}</p>
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
	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<div class="flex items-baseline gap-2">
			<h2>{t('subs.openPositions')}</h2>
			<span class="badge">{data.requests.length}</span>
		</div>
		{#if data.canManageRequests && data.requests.length > 0 && hasRequestableGames}
			<button
				class="btn-secondary btn-sm"
				type="button"
				onclick={() => (showRequest = !showRequest)}
				aria-expanded={showRequest}
				aria-controls="request-form"
			>
				{showRequest ? t('common.close') : t('subs.openRequest')}
			</button>
		{/if}
	</div>

	{#if data.canManageRequests && showRequest && hasRequestableGames}
		<section class="card mb-3" id="request-form">
			<h3 class="mb-3">{t('subs.openRequest')}</h3>
			<form
				method="POST"
				action="?/request"
				use:progressiveForm={{ onSuccess: () => (showRequest = false) }}
				class="grid gap-4 sm:grid-cols-2"
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
		</section>
	{/if}

	{#if data.requests.length === 0}
		<div class="card">
			<p class="text-sm text-muted">{t('subs.noneOpen')}</p>
			<p class="hint">
				{data.canManageRequests
					? hasRequestableGames
						? t('subs.requestEmptyManager')
						: t('subs.requestNeedsGame')
					: t('subs.requestEmptyPlayer')}
			</p>
			{#if data.canManageRequests && hasRequestableGames}
				<button
					class="btn-secondary btn-sm mt-3"
					type="button"
					onclick={() => (showRequest = !showRequest)}
					aria-expanded={showRequest}
					aria-controls="request-form"
				>
					{showRequest ? t('common.close') : t('subs.openRequest')}
				</button>
			{:else if data.canManageRequests && data.canManageGames}
				<a class="btn-secondary btn-sm mt-3" href="/admin/matchs">{t('home.createGame')}</a>
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
							{/if}
							<a class="link text-sm" href="/matchs/{request.gameId}">{t('subs.viewGame')}</a>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if data.canManageRequests}
	<section>
		<div class="mb-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div class="flex items-baseline gap-2">
					<h2>{t('subs.substituteList')}</h2>
					<span class="badge">{data.pool.length}</span>
				</div>
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
			<p class="hint">{t('subs.favoriteHelp')}</p>
		</div>

		{#if data.canManagePool && showInvite}
			<section class="card mb-3" id="invite-form">
				<h3 class="mb-3">{t('subs.addSubstitute')}</h3>
				<InvitePlayerForm
					action="?/inviteSubstitute"
					substitute
					submitLabel={t('subs.inviteSubstitute')}
					onSuccess={() => (showInvite = false)}
				/>
			</section>
		{/if}

		{#if data.pool.length === 0}
			<div class="card">
				<p class="text-sm text-muted">{t('subs.poolEmpty')}</p>
				{#if data.canManagePool}
					<p class="hint">{t('subs.poolEmptyHelp')}</p>
					<button
						class="btn-secondary btn-sm mt-3"
						type="button"
						onclick={() => (showInvite = !showInvite)}
						aria-expanded={showInvite}
						aria-controls="invite-form"
					>
						{showInvite ? t('common.close') : t('subs.addSubstitute')}
					</button>
				{/if}
			</div>
		{:else}
			<div class="card-flush overflow-hidden">
				<ul role="list" class="divide-y divide-line/70">
					{#each data.pool as substitute (substitute.playerId)}
						<li class="px-4 py-3">
							<div class="flex flex-wrap items-start justify-between gap-2">
								<span class="min-w-0 text-sm font-medium">{substitute.fullName}</span>
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
											class="btn btn-sm text-alert hover:bg-alert-soft"
										/>
									</form>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>
{/if}
