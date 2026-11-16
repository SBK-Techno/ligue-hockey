<script lang="ts">
	import { gameRatingAttributes } from '#config/rating-attributes.ts';
	import { positionDefinition } from '#config/positions.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import RatingScale from '#lib/ui/RatingScale.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
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
			form.ok && form.next === true && typeof form.playerId === 'string'
				? form.playerId
				: null;
		const failedId = form.ok === false && typeof form.playerId === 'string' ? form.playerId : null;
		if (!savedId && !failedId) return;

		void tick().then(() => {
			const players = assessment.players;
			const savedIndex = savedId
				? players.findIndex((player) => player.playerId === savedId)
				: -1;
			const targetId = failedId
				? failedId
				: savedIndex >= 0
					? (players.slice(savedIndex + 1).find((player) => !player.complete)?.playerId ??
						players.find((player) => !player.complete)?.playerId ??
						null)
					: null;
			if (!targetId) return;
			const sheet = document.getElementById(`assessment-${targetId}`);
			if (sheet instanceof HTMLDetailsElement) sheet.open = true;
			sheet?.scrollIntoView({ block: 'start', behavior: 'smooth' });
			sheet?.querySelector('summary')?.focus({ preventScroll: true });
		});
	});
</script>

<PageHeader
	title={t('rating.gameTitle')}
	meta="{formatDate(assessment.gameDate)} · {formatTime(assessment.startTime)} · {assessment.location}"
	back={{ href: '/admin/evaluations', label: t('admin.evaluationBack') }}
/>

<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
	<p class="font-mono text-xs text-muted">
		{t('rating.ratedPlayers', {
			done: assessment.ratedPlayers,
			total: assessment.totalPlayers
		})}
	</p>
	<p class="text-[11px] text-muted">{t('rating.gameHelp')}</p>
</div>

<FormFeedback {form} class="mb-4" />

{#if !assessment.canRate}
	<div class="notice mb-4">{t('rating.gameNotPlayed')}</div>
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
			<summary
				class="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5"
			>
				<span class="jersey">{player.jerseyNumber ?? t('rating.notAvailable')}</span>
				<span class="min-w-0 flex-1">
					<span class="block truncate text-sm font-semibold">{player.fullName}</span>
					<span class="mt-0.5 block text-xs text-muted">
						{t(positionDefinition(player.position).labelKey)}
					</span>
				</span>
				{#if form?.ok && form.playerId === player.playerId}
					<span class="badge-ok" role="status">{t('rating.saved')}</span>
				{:else}
					<span class="badge {player.complete ? 'badge-ok' : ''}">
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

			{#key `${player.version}:${JSON.stringify(player.values)}`}
				<form
					method="POST"
					action="?/save"
					use:progressiveForm={{ reset: false }}
					class="border-t border-line px-4 py-2"
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
							<button class="btn-primary btn-sm" type="submit" name="next" value="1">
								{t('rating.saveNext')}
							</button>
							<button class="btn-secondary btn-sm" type="submit">
								{t('common.save')}
							</button>
							<button class="btn-ghost btn-sm" type="submit" name="clear" value="1">
								{t('rating.notSeenGame')}
							</button>
						</div>
					{/if}
				</form>
			{/key}
		</details>
	{/each}
</div>
