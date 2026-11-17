<script lang="ts">
	import { gameRatingAttributes } from '#config/rating-attributes.ts';
	import { positionDefinition } from '#config/positions.ts';
	import { formatCount, formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import RatingScale from '#lib/ui/RatingScale.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import { prefersReducedMotion, scrollBehavior } from '#lib/ui/scroll.ts';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const assessment = $derived(data.assessment);
	const firstUnrated = $derived(
		assessment.players.find((player) => !player.complete)?.playerId ?? null
	);

	let handled: typeof form = null;
	$effect(() => {
		if (!form || form === handled) return;
		handled = form;
		const savedId =
			form.ok && typeof form.playerId === 'string' ? form.playerId : null;
		const failedId = form.ok === false && typeof form.playerId === 'string' ? form.playerId : null;
		if (!savedId && !failedId) return;

		void tick().then(() => {
			const players = assessment.players;
			const savedIndex = savedId
				? players.findIndex((player) => player.playerId === savedId)
				: -1;
			const savedPlayer = savedIndex >= 0 ? players[savedIndex] : null;
			const nextIncomplete = savedIndex >= 0
				? (players.slice(savedIndex + 1).find((player) => !player.complete)?.playerId ??
					players.find((player) => !player.complete)?.playerId ??
					null)
				: null;
			// Une feuille complète ne laisse pas le focus sur le corps de page :
			// on garde la feuille enregistrée ouverte quand il n'y a plus rien à remplir.
			const targetId =
				failedId ??
				(savedPlayer
					? savedPlayer.complete
						? (nextIncomplete ?? savedPlayer.playerId)
						: savedPlayer.playerId
					: null);
			if (!targetId) {
				document.getElementById('contenu')?.focus({ preventScroll: true });
				return;
			}
			const sheet = document.getElementById(`assessment-${targetId}`);
			if (sheet instanceof HTMLDetailsElement) sheet.open = true;
			sheet?.scrollIntoView({
				block: 'start',
				behavior: scrollBehavior(prefersReducedMotion())
			});
			sheet?.querySelector('summary')?.focus({ preventScroll: true });
		});
	});
</script>

<PageHeader
	title={t('rating.gameTitle')}
	meta="{formatDate(assessment.gameDate)} · {formatTime(assessment.startTime)} · {assessment.location}"
	back={{ href: '/admin/evaluations', label: t('admin.evaluationBack') }}
/>

<div class="page-stack">
	<div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
		<p class="min-w-0 text-meta text-muted">
			{formatCount(
				assessment.ratedPlayers,
				'rating.ratedPlayers.one',
				'rating.ratedPlayers.many',
				{ total: assessment.totalPlayers }
			)}
		</p>
		<p class="min-w-0 text-meta text-muted">{t('rating.gameHelp')}</p>
	</div>

	<FormFeedback {form} />

	{#if !assessment.canRate}
		<div class="notice">{t('rating.gameNotPlayed')}</div>
	{/if}

	<div class="space-y-2">
		{#each assessment.players as player (player.playerId)}
			{@const attributes = gameRatingAttributes(player.position)}
			<details
				id="assessment-{player.playerId}"
				class="sheet group"
				name="assessment"
				open={player.playerId === firstUnrated}
			>
				<summary class="section-row flex min-h-14 cursor-pointer list-none items-center gap-3">
					<span class="jersey">{player.jerseyNumber ?? '-'}</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-body font-semibold">{player.fullName}</span>
						<span class="mt-0.5 block text-meta text-muted">
							{t(positionDefinition(player.position).labelKey)}
						</span>
					</span>
					{#if form?.ok && form.playerId === player.playerId}
						<span class="badge-ok" role="status">{t('rating.saved')}</span>
					{:else}
						<span class={player.complete ? 'badge-ok' : 'badge'}>
							{player.rated}/{player.total}
						</span>
					{/if}
					<svg
						viewBox="0 0 24 24"
						class="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="m6 9 6 6 6-6" />
					</svg>
				</summary>

				{#key `${player.version}:${JSON.stringify(player.values)}:${
					form?.playerId === player.playerId ? (form.revision ?? '') : ''
				}`}
					<form
						method="POST"
						action="?/save"
						use:progressiveForm={{ reset: false }}
						class="section-row border-t border-line"
					>
						<input type="hidden" name="playerId" value={player.playerId} />
						<fieldset class="contents" disabled={!assessment.canRate}>
							{#each attributes as attribute (attribute.key)}
								<RatingScale
									name={attribute.key}
									label={t(attribute.labelKey)}
									help={t(attribute.helpKey)}
									value={player.values[attribute.key]}
									clearable={assessment.canRate}
									disabled={!assessment.canRate}
								/>
							{/each}
						</fieldset>
						{#if assessment.canRate}
							<div class="mt-3 flex flex-wrap gap-2">
								<button class="btn-primary btn-sm" type="submit">
									{t('rating.saveNext')}
								</button>
								<ConfirmSubmit
									label={t('rating.notSeenGame')}
									question={t('rating.notSeenGameConfirm', { name: player.fullName })}
									confirmLabel={t('rating.notSeenGame')}
									class="btn-ghost btn-sm"
									submitName="clear"
									submitValue="1"
								/>
							</div>
						{/if}
					</form>
				{/key}
			</details>
		{/each}
	</div>
</div>
