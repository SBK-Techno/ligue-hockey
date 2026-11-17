<script lang="ts">
	import { onMount } from 'svelte';
	import {
		RATING_ATTRIBUTES,
		RATING_SCALE,
		positionRatingAttributes
	} from '#config/rating-attributes.ts';
	import { positionDefinition } from '#config/positions.ts';
	import { formatDecimal, t } from '#lib/shared/i18n/index.ts';
	import Avatar from './Avatar.svelte';
	import {
		cancelPlayerPeekClose,
		closePlayerPeek,
		playerPeek,
		schedulePlayerPeekClose
	} from './player-peek.svelte.ts';
	import {
		isPeekSheet,
		peekPlacement,
		type PeekViewport
	} from './player-peek.ts';

	let viewport = $state<PeekViewport>({ width: 0, height: 0 });
	let card = $state<HTMLElement | null>(null);

	const sheet = $derived(isPeekSheet(viewport.width));
	const placement = $derived(
		!sheet && playerPeek.anchor
			? peekPlacement(playerPeek.anchor, viewport)
			: null
	);
	const style = $derived(
		placement
			? `top:${placement.top}px;left:${placement.left}px;width:${placement.width}px`
			: ''
	);
	const scale = Array.from(
		{ length: RATING_SCALE.max - RATING_SCALE.min + 1 },
		(_, index) => RATING_SCALE.min + index
	);

	function updateViewport() {
		viewport = { width: window.innerWidth, height: window.innerHeight };
	}

	function onViewportChange() {
		updateViewport();
		if (playerPeek.openId) closePlayerPeek();
	}

	onMount(() => {
		updateViewport();
		window.addEventListener('resize', onViewportChange);
		window.addEventListener('scroll', onViewportChange, { passive: true });
		return () => {
			window.removeEventListener('resize', onViewportChange);
			window.removeEventListener('scroll', onViewportChange);
		};
	});

	$effect(() => {
		if (playerPeek.pinned && playerPeek.openId && card) card.focus();
	});
</script>

{#if playerPeek.openId}
	<div
		class="player-peek"
		class:player-peek-sheet={sheet}
		style={style}
		role="dialog"
		aria-modal="false"
		aria-label={playerPeek.view
			? t('peek.dialog', { name: playerPeek.view.player.fullName })
			: t('peek.loadingTitle')}
		data-player-peek-card
		bind:this={card}
		tabindex="-1"
		onpointerenter={cancelPlayerPeekClose}
		onpointerleave={schedulePlayerPeekClose}
	>
		<button
			class="player-peek-close"
			type="button"
			onclick={() => closePlayerPeek({ restoreFocus: true })}
			aria-label={t('peek.close')}
		>
			<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
				<path d="m6 6 12 12M18 6 6 18" />
			</svg>
		</button>

		{#if playerPeek.status === 'loading'}
			<p class="py-6 text-center text-meta text-muted" role="status">{t('peek.loading')}</p>
		{:else if playerPeek.status === 'error'}
			<p class="py-6 text-center text-meta text-muted" role="alert">{t('peek.error')}</p>
		{:else if playerPeek.view}
			{@const view = playerPeek.view}
			{@const ratings = view.ratings}
			<div class="flex items-start gap-3 pr-7">
				<Avatar player={view.player} size={48} peek={false} />
				<div class="min-w-0">
					<p class="truncate text-section font-semibold">{view.player.fullName}</p>
					<p class="mt-0.5 text-meta text-muted">
						#{view.player.jerseyNumber ?? '-'} · {t(
							positionDefinition(view.player.position).labelKey
						)}
					</p>
					<div class="mt-1 flex flex-wrap gap-1">
						{#if view.player.isSubstitute}
							<span class="badge">{t('profile.substitute')}</span>
						{/if}
						{#if !view.player.active}
							<span class="badge">{t('admin.inactive')}</span>
						{/if}
					</div>
				</div>
			</div>

			{#if view.legend}
				<p class="mt-3 border-t border-line pt-2 text-caption font-semibold text-muted">
					{t('profile.legendIdentity', {
						name: view.legend.name,
						number: view.legend.number,
						era: view.legend.era
					})}
				</p>
			{/if}

			<div class="mt-3 border-t border-line pt-3">
				<dl class="grid grid-cols-5 divide-x divide-line border-y border-line">
					<div class="px-0.5 py-1.5 text-center">
						<dt class="text-stamp text-muted">{t('peek.games')}</dt>
						<dd class="font-mono text-body font-semibold">{view.stats.games}</dd>
					</div>
					<div class="px-0.5 py-1.5 text-center">
						<dt class="text-stamp text-muted">{t('peek.goals')}</dt>
						<dd class="font-mono text-body font-semibold">{view.stats.goals}</dd>
					</div>
					<div class="px-0.5 py-1.5 text-center">
						<dt class="text-stamp text-muted">{t('peek.assists')}</dt>
						<dd class="font-mono text-body font-semibold">{view.stats.assists}</dd>
					</div>
					<div class="px-0.5 py-1.5 text-center">
						<dt class="text-stamp text-muted">{t('peek.points')}</dt>
						<dd class="font-mono text-body font-semibold">{view.stats.points}</dd>
					</div>
					<div class="px-0.5 py-1.5 text-center">
						<dt class="text-stamp text-muted">{t('peek.penaltyMinutes')}</dt>
						<dd class="font-mono text-body font-semibold">{view.stats.penaltyMinutes}</dd>
					</div>
				</dl>
				<p class="mt-1 text-stamp text-muted">{t('peek.statsHelp')}</p>
			</div>

			{#if ratings}
				<div class="mt-3 border-t border-line pt-3">
					<div class="flex items-baseline justify-between gap-2">
						<h3 class="text-meta font-semibold">{t('peek.skills')}</h3>
						<p class="text-caption text-muted">
							{t('peek.overall')}
							<span class="ml-1 font-mono font-semibold text-ink">
								{ratings.overall === null ? '-' : formatDecimal(ratings.overall, 2)}
							</span>
						</p>
					</div>
					<div class="mt-2 space-y-1.5">
						{#each RATING_ATTRIBUTES as attribute (attribute.key)}
							{@const value = ratings.values[attribute.key] ?? 0}
							<div class="flex items-center gap-2">
								<span class="w-20 shrink-0 text-caption text-muted">{t(attribute.labelKey)}</span>
								<span class="flex flex-1 gap-0.5" aria-hidden="true">
									{#each scale as step (step)}
										<span
											class="h-1.5 flex-1 rounded-full {step <= value ? 'bg-ice' : 'bg-line'}"
										></span>
									{/each}
								</span>
								<span class="w-6 text-right font-mono text-caption">
									{value || '-'}
								</span>
							</div>
						{/each}
					</div>

					<div class="mt-3 flex items-baseline justify-between gap-2 border-t border-line pt-2">
						<h3 class="text-meta font-semibold">{t('peek.positionSkills')}</h3>
						<p class="text-caption text-muted">
							{t('peek.positionOverall')}
							<span class="ml-1 font-mono font-semibold text-ink">
								{ratings.positionOverall === null
									? '-'
									: formatDecimal(ratings.positionOverall, 2)}
							</span>
						</p>
					</div>
					<div class="mt-2 space-y-1.5">
						{#each positionRatingAttributes(view.player.position) as attribute (attribute.key)}
							{@const value = ratings.positionValues[attribute.key] ?? 0}
							<div class="flex items-center gap-2">
								<span class="w-20 shrink-0 text-caption text-muted">{t(attribute.labelKey)}</span>
								<span class="flex flex-1 gap-0.5" aria-hidden="true">
									{#each scale as step (step)}
										<span
											class="h-1.5 flex-1 rounded-full {step <= value ? 'bg-ice' : 'bg-line'}"
										></span>
									{/each}
								</span>
								<span class="w-6 text-right font-mono text-caption">
									{value || '-'}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<p class="mt-3 border-t border-line pt-3 text-caption text-muted">
					{t('profile.ratingsHidden')}
				</p>
			{/if}
		{/if}
	</div>
{/if}
