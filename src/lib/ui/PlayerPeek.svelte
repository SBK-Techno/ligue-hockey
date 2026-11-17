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
		openPlayerPeek,
		playerPeek,
		schedulePlayerPeekClose,
		schedulePlayerPeekOpen
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

	function triggerFrom(target: EventTarget | null): HTMLElement | null {
		if (!(target instanceof Element)) return null;
		const trigger = target.closest<HTMLElement>('[data-player-id]');
		if (!trigger || trigger.closest('[data-player-peek-card]')) return null;
		return trigger.dataset.playerId ? trigger : null;
	}

	function onPointerOver(event: PointerEvent) {
		const trigger = triggerFrom(event.target);
		if (!trigger) return;
		if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) {
			return;
		}
		schedulePlayerPeekOpen(trigger.dataset.playerId as string, trigger);
	}

	function onPointerOut(event: PointerEvent) {
		const trigger = triggerFrom(event.target);
		if (!trigger) return;
		if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) {
			return;
		}
		if (playerPeek.openId === trigger.dataset.playerId) schedulePlayerPeekClose();
	}

	function onClick(event: MouseEvent) {
		const trigger = triggerFrom(event.target);
		if (!trigger) {
			if (
				playerPeek.openId &&
				!(event.target instanceof Element && event.target.closest('[data-player-peek-card]'))
			) {
				closePlayerPeek();
			}
			return;
		}
		const playerId = trigger.dataset.playerId as string;
		if (trigger.dataset.playerPeek === 'click') {
			openPlayerPeek(playerId, trigger, { pinned: true });
			return;
		}
		const interactive = trigger.closest('a,button,[role="button"],label');
		if (interactive && interactive !== trigger) return;
		if (trigger.matches('a,button')) return;
		openPlayerPeek(playerId, trigger, { pinned: true });
	}

	function onFocusIn(event: FocusEvent) {
		const trigger = triggerFrom(event.target);
		if (!trigger) return;
		if (trigger.dataset.playerPeek === 'click' || !trigger.matches('a,button')) {
			openPlayerPeek(trigger.dataset.playerId as string, trigger, { pinned: true });
		}
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && playerPeek.openId) {
			event.preventDefault();
			closePlayerPeek({ restoreFocus: true });
		}
	}

	function onPointerDown(event: PointerEvent) {
		if (!playerPeek.openId) return;
		if (event.target instanceof Element && event.target.closest('[data-player-peek-card]')) {
			return;
		}
		if (event.target instanceof Element && event.target.closest('[data-player-id]')) return;
		closePlayerPeek();
	}

	function updateViewport() {
		viewport = { width: window.innerWidth, height: window.innerHeight };
	}

	function onViewportChange() {
		updateViewport();
		if (playerPeek.openId) closePlayerPeek();
	}

	onMount(() => {
		updateViewport();
		document.addEventListener('pointerover', onPointerOver);
		document.addEventListener('pointerout', onPointerOut);
		document.addEventListener('click', onClick);
		document.addEventListener('focusin', onFocusIn);
		document.addEventListener('keydown', onKeyDown);
		document.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('resize', onViewportChange);
		window.addEventListener('scroll', onViewportChange, { passive: true });
		return () => {
			document.removeEventListener('pointerover', onPointerOver);
			document.removeEventListener('pointerout', onPointerOut);
			document.removeEventListener('click', onClick);
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('pointerdown', onPointerDown);
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
			<p class="py-6 text-center text-meta text-muted">{t('peek.loading')}</p>
		{:else if playerPeek.status === 'error'}
			<p class="py-6 text-center text-meta text-muted">{t('peek.error')}</p>
		{:else if playerPeek.view}
			{@const view = playerPeek.view}
			{@const ratings = view.ratings}
			<div class="flex items-start gap-3 pr-7">
				<Avatar player={view.player} size={48} decorative={false} peek={false} />
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
						number: view.legend.number
					})}
				</p>
			{/if}

			<div class="mt-3 border-t border-line pt-3">
				<dl class="grid grid-cols-5 gap-1.5">
					<div class="border border-line bg-paper-deep/40 px-1 py-1.5 text-center">
						<dt class="text-stamp text-muted">{t('peek.games')}</dt>
						<dd class="font-mono text-body font-semibold">{view.stats.games}</dd>
					</div>
					<div class="border border-line bg-paper-deep/40 px-1 py-1.5 text-center">
						<dt class="text-stamp text-muted">{t('peek.goals')}</dt>
						<dd class="font-mono text-body font-semibold">{view.stats.goals}</dd>
					</div>
					<div class="border border-line bg-paper-deep/40 px-1 py-1.5 text-center">
						<dt class="text-stamp text-muted">{t('peek.assists')}</dt>
						<dd class="font-mono text-body font-semibold">{view.stats.assists}</dd>
					</div>
					<div class="border border-line bg-paper-deep/40 px-1 py-1.5 text-center">
						<dt class="text-stamp text-muted">{t('peek.points')}</dt>
						<dd class="font-mono text-body font-semibold">{view.stats.points}</dd>
					</div>
					<div class="border border-line bg-paper-deep/40 px-1 py-1.5 text-center">
						<dt class="text-stamp text-muted">{t('peek.penalties')}</dt>
						<dd class="font-mono text-body font-semibold">{view.stats.penalties}</dd>
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
