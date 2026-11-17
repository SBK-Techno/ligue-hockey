<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
	import type { SubRequestWithGame } from '#lib/domain/roster/service.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
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

<SectionCard title={t('subs.title')} flush>
	{#if requests.length > 0}
		<p class="section-row pb-0 text-meta text-muted">{t('home.substitutesHelp')}</p>
		<ul role="list" class="mt-2 divide-y divide-line">
			{#each requests as request (request.id)}
				<li class="section-row flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="text-body font-semibold">
							{t(positionDefinition(request.position).labelKey)}
						</p>
						<p class="mt-0.5 break-words text-meta text-muted">
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
		<div class="section-row {requests.length === 0 ? '' : 'border-t border-line'}">
			<p class="text-body font-semibold">
				{ownRequest.status === 'open'
					? t('home.substitutesOwnRequest')
					: t('home.substitutesOwnRequestFilled')}
			</p>
			<p class="mt-0.5 break-words text-meta text-muted">
				{formatDate(ownRequest.game.gameDate, 'short')} · {formatTime(ownRequest.game.startTime)}
			</p>
			{#if ownRequest.status === 'filled'}
				<p class="hint">{filledRequestLabel(ownRequest)}</p>
			{/if}
			<a class="action-link text-body" href="/remplacants">{t('home.actionOwnRequestLink')}</a>
			{#if ownRequest.status === 'open'}
				<form method="POST" action="?/cancelRequest" use:progressiveForm class="mt-2">
					<input type="hidden" name="gameId" value={ownRequest.gameId} />
					<input type="hidden" name="requestId" value={ownRequest.id} />
					<ConfirmSubmit
						label={t('subs.cancelRequest')}
						question={t('subs.cancelRequestConfirm')}
						confirmLabel={t('subs.cancelRequest')}
						class="btn-danger btn-sm"
					/>
				</form>
			{/if}
		</div>
	{/if}
</SectionCard>
