<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
	import type { SubRequestWithGame } from '#lib/domain/roster/service.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { filledRequestLabel } from '#lib/ui/filled-request.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	let {
		requests,
		ownRequest
	}: {
		requests: SubRequestWithGame[];
		ownRequest: SubRequestWithGame | null;
	} = $props();
</script>

<SectionCard title={t('subs.title')}>
	{#if requests.length > 0}
		<p class="px-4 pt-3 text-xs text-muted">{t('home.substitutesHelp')}</p>
		<ul role="list" class="mt-2 divide-y divide-line">
			{#each requests as request (request.id)}
				<li class="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
					<div class="min-w-0">
						<p class="text-sm font-semibold">
							{t(positionDefinition(request.position).labelKey)}
						</p>
						<p class="mt-0.5 break-words text-xs text-muted">
							{formatDate(request.game.gameDate, 'short')} ·
							{formatTime(request.game.startTime)} · {request.game.location}
						</p>
						{#if request.requestedByName}
							<p class="hint">{t('subs.requestedBy', { name: request.requestedByName })}</p>
						{/if}
					</div>
					<form method="POST" action="?/claim" use:progressiveForm>
						<input type="hidden" name="gameId" value={request.gameId} />
						<input type="hidden" name="requestId" value={request.id} />
						<button class="btn-primary btn-sm" type="submit">{t('subs.claim')}</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	{#if ownRequest}
		<div class="px-4 py-3 {requests.length === 0 ? '' : 'border-t border-line'}">
			<p class="text-sm font-semibold">
				{ownRequest.status === 'open'
					? t('home.substitutesOwnRequest')
					: t('home.substitutesOwnRequestFilled')}
			</p>
			<p class="mt-0.5 break-words text-xs text-muted">
				{formatDate(ownRequest.game.gameDate, 'short')} · {formatTime(ownRequest.game.startTime)}
			</p>
			{#if ownRequest.status === 'filled'}
				<p class="hint">{filledRequestLabel(ownRequest)}</p>
			{/if}
			<a class="action-link text-sm" href="/remplacants">{t('home.actionOwnRequestLink')}</a>
		</div>
	{/if}
</SectionCard>
