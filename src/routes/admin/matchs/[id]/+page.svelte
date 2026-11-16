<script lang="ts">
	import { GAME_LIMITS } from '#lib/domain/games/validators.ts';
	import { gameStatus } from '#config/game-status.ts';
	import { formatDate, formatDecimal, formatTime, t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const game = $derived(data.game);
	const intelligence = $derived(data.intelligence);

</script>

<FormFeedback {form} class="mb-4" />

{#if !game}
	<div class="card">
		<h1>{t('games.noMatch')}</h1>
		<a class="btn-secondary mt-4" href="/admin/matchs">{t('admin.backToGames')}</a>
	</div>
{:else}
	<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<div>
			<a class="link text-sm" href="/admin/matchs">{t('admin.backToGames')}</a>
			<h1 class="mt-2 capitalize">{formatDate(game.gameDate)}</h1>
			<p class="mt-1.5 text-sm text-muted">
				{formatTime(game.startTime)} · {game.location}
				· <span class="badge">{t(gameStatus(game.status).labelKey)}</span>
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if data.canAssess}
				<a class="btn-primary btn-sm" href="/admin/evaluations/matchs/{game.id}">
					{t('rating.editGame')}
				</a>
			{/if}
			<a class="btn-secondary btn-sm" href="/matchs/{game.id}">{t('home.viewGame')}</a>
		</div>
	</div>

	{#if game.status === 'cancelled'}
		<div class="alert mb-4">
			<p class="font-semibold">{t('games.cancelledNotice')}</p>
		</div>
	{:else if game.status !== 'scheduled'}
		<div class="notice mb-4">{t('admin.gameNotScheduled')}</div>
	{/if}

	{#if game.status === 'scheduled'}
	<section class="card mb-4">
		<h2 class="mb-3">{t('games.adminEdit')}</h2>
		<form method="POST" action="?/update" use:progressiveForm class="grid gap-3 sm:grid-cols-2">
			<div>
				<label class="label" for="gameDate">{t('games.date')}</label>
				<input
					class="input"
					id="gameDate"
					name="gameDate"
					type="date"
					value={game.gameDate}
					required
					disabled={game.status !== 'scheduled'}
				/>
			</div>
			<div>
				<label class="label" for="startTime">{t('games.time')}</label>
				<input
					class="input"
					id="startTime"
					name="startTime"
					type="time"
					value={game.startTime}
					required
					disabled={game.status !== 'scheduled'}
				/>
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="location">{t('games.location')}</label>
				<input
					class="input"
					id="location"
					name="location"
					value={game.location}
					maxlength={GAME_LIMITS.locationMax}
					required
					disabled={game.status !== 'scheduled'}
				/>
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="notes">{t('games.notes')}</label>
				<textarea
					class="input"
					id="notes"
					name="notes"
					rows="3"
					maxlength={GAME_LIMITS.notesMax}
					disabled={game.status !== 'scheduled'}>{game.notes ?? ''}</textarea
				>
			</div>
			<div class="flex flex-wrap gap-2 sm:col-span-2">
				<button class="btn-primary" type="submit">
					{t('common.save')}
				</button>
			</div>
		</form>
	</section>
	{:else}
		<section class="card mb-4">
			<h2>{t('games.adminEdit')}</h2>
			<dl class="mt-3 divide-y divide-line">
				<div class="fact"><dt>{t('games.date')}</dt><dd>{formatDate(game.gameDate)}</dd></div>
				<div class="fact"><dt>{t('games.time')}</dt><dd>{formatTime(game.startTime)}</dd></div>
				<div class="fact"><dt>{t('games.location')}</dt><dd>{game.location}</dd></div>
				{#if game.notes}
					<div class="fact"><dt>{t('games.notes')}</dt><dd class="text-right">{game.notes}</dd></div>
				{/if}
			</dl>
		</section>
	{/if}

	<section class="card mb-4">
		<div class="section-title">
			<h2>{t('games.roster')}</h2>
			{#if game.generated}
				<span class="badge-ice">{t('games.generated')}</span>
			{:else}
				<span class="badge">{t('games.notGenerated')}</span>
			{/if}
		</div>

		{#if game.generated && intelligence}
			<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
				<div>
					<dt class="micro-label">{t('games.averageWhite')}</dt>
					<dd class="numeric mt-0.5 text-xl">{formatDecimal(intelligence.averageWhite, 2)}</dd>
				</div>
				<div>
					<dt class="micro-label">{t('games.averageBlack')}</dt>
					<dd class="numeric mt-0.5 text-xl">{formatDecimal(intelligence.averageBlack, 2)}</dd>
				</div>
				<div>
					<dt class="micro-label">{t('games.smartBalance')}</dt>
					<dd class="mt-0.5 text-sm font-semibold">
						{formatDecimal(intelligence.skillDiff, 2)} note · {formatDecimal(
							intelligence.ageDiff,
							1
						)} ans
					</dd>
				</div>
				<div>
					<dt class="micro-label">{t('games.roster')}</dt>
					<dd class="mt-0.5 text-sm font-semibold">
						{game.slots.filter((slot) => slot.player).length}/{game.slots.length}
					</dd>
				</div>
			</dl>

			{#if intelligence.swap}
				<div class="notice mt-4">
					<p class="font-semibold">{t('games.bestSwap')}</p>
					<p class="mt-1 text-sm leading-snug">
						{t('games.bestSwapHelp', {
							a: intelligence.swap.nameA,
							b: intelligence.swap.nameB,
							before: formatDecimal(intelligence.swap.skillDiffBefore, 2),
							after: formatDecimal(intelligence.swap.skillDiffAfter, 2)
						})}
					</p>
					<form method="POST" action="?/swap" use:progressiveForm class="mt-2">
						<button class="btn-secondary btn-sm" type="submit">{t('games.applySwap')}</button>
					</form>
				</div>
			{:else}
				<p class="hint mt-3">{t('games.alreadyBalanced')}</p>
			{/if}

			{#if intelligence.fills.count > 0}
				<div class="mt-3 border border-line p-3">
					<p class="text-sm font-semibold">{t('games.fillSlots')}</p>
					<p class="hint mt-1">
						{t('games.fillSlotsHelp', { count: intelligence.fills.count })}
						{intelligence.fills.names.join(', ')}
					</p>
					<form method="POST" action="?/fill" use:progressiveForm class="mt-2">
						<button class="btn-secondary btn-sm" type="submit">{t('games.fillSlots')}</button>
					</form>
				</div>
			{/if}

			<div class="mt-4 flex flex-wrap items-center gap-2">
				{#if game.status === 'scheduled'}
					<form method="POST" action="?/generate" use:progressiveForm>
						{#if game.generated}
							<ConfirmSubmit
								label={t('games.regenerate')}
								title={t('games.regenerate')}
								question={t('games.regenerateConfirm')}
								confirmLabel={t('games.regenerate')}
								cancelLabel={t('common.back')}
								tone="neutral"
								class="btn-secondary btn-sm"
							/>
						{:else}
							<button class="btn-primary btn-sm" type="submit">{t('games.generate')}</button>
						{/if}
					</form>
				{/if}
				<a class="btn-ghost btn-sm" href="/matchs/{game.id}">{t('admin.openSheet')}</a>
			</div>
		{:else}
			<p class="mt-2 text-sm text-muted">{t('games.lineupSoon')}</p>
			{#if game.status === 'scheduled'}
				<form method="POST" action="?/generate" use:progressiveForm class="mt-3">
					<button class="btn-primary" type="submit">{t('games.generate')}</button>
				</form>
			{/if}
		{/if}
	</section>

	{#if game.status === 'scheduled'}
		<section class="card border-alert/30">
			<h2 class="text-alert">{t('admin.dangerZone')}</h2>
			<p class="mt-1 text-sm text-muted">{t('admin.cancelHelp')}</p>
			<form method="POST" action="?/cancel" use:progressiveForm class="mt-4">
				<ConfirmSubmit
					label={t('games.adminCancel')}
					question={t('admin.cancelGameQuestion', { date: formatDate(game.gameDate) })}
					confirmLabel={t('games.adminCancel')}
				/>
			</form>
		</section>
	{/if}
{/if}
