<script lang="ts">
	import { positionDefinition } from '#config/positions.ts';
	import type { ChatPollView } from '#lib/domain/chat/service.ts';
	import type { BalanceView } from '#lib/domain/finance/service.ts';
	import type { HomeAction } from '#lib/domain/home/composition.ts';
	import type { PlayedGameAssessment } from '#lib/domain/ratings/service.ts';
	import type { SubRequestWithGame } from '#lib/domain/roster/service.ts';
	import { formatDate, formatMoney, t } from '#lib/shared/i18n/index.ts';
	import PollOptions from '#lib/ui/PollOptions.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	let {
		actions,
		balance,
		evaluationGame,
		ownRequest,
		claimable,
		openPoll
	}: {
		actions: HomeAction[];
		balance: BalanceView | null;
		evaluationGame: PlayedGameAssessment | null;
		ownRequest: SubRequestWithGame | null;
		claimable: SubRequestWithGame[];
		openPoll: { messageId: string; poll: ChatPollView; unvoted: boolean } | null;
	} = $props();

	const claim = $derived(claimable[0] ?? null);
</script>

<SectionCard title={t('home.actionsTitle')} flush>
	<ul role="list" class="divide-y divide-line">
		{#each actions as action (action.kind)}
			<li class="section-row">
				{#if action.kind === 'balance' && balance}
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-body font-semibold {balance.isOverdue ? 'text-alert' : ''}">
								{t(balance.isOverdue ? 'home.actionBalanceOverdue' : 'home.actionBalanceDue')}
							</p>
							<p class="mt-0.5 break-words text-meta text-muted">
								{t('home.actionBalanceAmount', {
									amount: formatMoney(balance.outstandingCents, balance.currency)
								})}
							</p>
						</div>
						<a class="btn-secondary btn-sm" href="/solde">{t('home.actionBalanceLink')}</a>
					</div>
				{:else if action.kind === 'evaluations' && evaluationGame}
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-body font-semibold">{t('home.actionEvaluations')}</p>
							<p class="mt-0.5 break-words text-meta text-muted">
								{t('home.actionEvaluationsDetail', {
									date: formatDate(evaluationGame.gameDate, 'short'),
									location: evaluationGame.location
								})}
							</p>
						</div>
						<a
							class="btn-secondary btn-sm"
							href="/admin/evaluations/matchs/{evaluationGame.gameId}"
						>
							{t('rating.editGame')}
						</a>
					</div>
				{:else if action.kind === 'own-request' && ownRequest}
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-body font-semibold">{t('home.actionOwnRequest')}</p>
							<p class="mt-0.5 break-words text-meta text-muted">
								{t('home.actionOwnRequestDetail', {
									date: formatDate(ownRequest.game.gameDate, 'short')
								})}
							</p>
						</div>
						<a class="btn-secondary btn-sm" href="/remplacants">
							{t('home.actionOwnRequestLink')}
						</a>
						<form method="POST" action="?/cancelRequest" use:progressiveForm>
							<input type="hidden" name="gameId" value={ownRequest.gameId} />
							<input type="hidden" name="requestId" value={ownRequest.id} />
							<ConfirmSubmit
								label={t('subs.cancelRequest')}
								question={t('subs.cancelRequestConfirm')}
								confirmLabel={t('subs.cancelRequest')}
								class="btn-danger btn-sm"
							/>
						</form>
					</div>
				{:else if action.kind === 'claim' && claim}
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-body font-semibold">{t('home.actionClaim')}</p>
							<p class="mt-0.5 break-words text-meta text-muted">
								{t('home.actionClaimDetail', {
									position: t(positionDefinition(claim.position).labelKey),
									date: formatDate(claim.game.gameDate, 'short'),
									location: claim.game.location
								})}
							</p>
						</div>
						<form method="POST" action="?/claim" use:progressiveForm>
							<input type="hidden" name="gameId" value={claim.gameId} />
							<input type="hidden" name="requestId" value={claim.id} />
							<button class="btn-primary btn-sm" type="submit">{t('subs.claim')}</button>
						</form>
					</div>
				{:else if action.kind === 'poll' && openPoll}
					<div class="min-w-0">
						<p class="micro-label">{t('chat.pollTag')}</p>
						<PollOptions
							messageId={openPoll.messageId}
							poll={openPoll.poll}
							class="mt-1"
						/>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</SectionCard>
