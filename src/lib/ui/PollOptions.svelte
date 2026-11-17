<script lang="ts">
	import type { ChatPollView } from '#lib/domain/chat/service.ts';
	import { formatCount, formatPercent, t } from '#lib/shared/i18n/index.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	let {
		messageId,
		poll,
		action = '?/vote',
		showQuestion = true,
		onsuccess,
		class: className = ''
	}: {
		messageId: string;
		poll: ChatPollView;
		/** La même action `?/vote` sur la discussion et sur l'accueil. */
		action?: string;
		showQuestion?: boolean;
		/** Le parent rafraîchit son cache après un vote accepté. */
		onsuccess?: () => void;
		class?: string;
	} = $props();

	const questionId = $props.id();
	const total = $derived(poll.options.reduce((sum, option) => sum + option.votes, 0));
	const myOption = $derived(poll.options.find((option) => option.myVote) ?? null);
	const open = $derived(!poll.closed);
</script>

<div class={className}>
	{#if showQuestion}
		<p id={questionId} class="break-words text-body font-semibold">{poll.question}</p>
	{/if}

	<div
		role="group"
		aria-labelledby={showQuestion ? questionId : undefined}
		aria-label={showQuestion ? undefined : t('chat.pollTag')}
	>
		<ul role="list" class="mt-3 space-y-1.5">
			{#each poll.options as option (option.id)}
				{@const share = total > 0 ? option.votes / total : 0}
				<li>
					{#if open}
						<form method="POST" action={action} use:progressiveForm={{ onSuccess: onsuccess }}>
							<input type="hidden" name="messageId" value={messageId} />
							<input type="hidden" name="optionId" value={option.id} />
							<button
								type="submit"
								class="poll-option"
								data-mine={option.myVote}
								aria-pressed={option.myVote}
							>
								<span class="poll-fill" style="--share: {share}" aria-hidden="true"></span>
								<span class="poll-label">
									{#if option.myVote}
										<svg viewBox="0 0 16 16" class="h-4 w-4 shrink-0" aria-hidden="true">
											<path
												d="M3 8.5 6.2 12 13 4.5"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									{/if}
									<span class="min-w-0 break-words">{option.label}</span>
								</span>
								<span class="poll-score">
									{formatPercent(option.votes, total)}
									<span class="text-muted">{option.votes}</span>
								</span>
							</button>
						</form>
					{:else}
						<div class="poll-option" data-mine={option.myVote} data-closed="true">
							<span class="poll-fill" style="--share: {share}" aria-hidden="true"></span>
							<span class="poll-label">
								{#if option.myVote}
									<svg viewBox="0 0 16 16" class="h-4 w-4 shrink-0" aria-hidden="true">
										<path
											d="M3 8.5 6.2 12 13 4.5"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								{/if}
								<span class="min-w-0 break-words">{option.label}</span>
							</span>
							<span class="poll-score">
								{formatPercent(option.votes, total)}
								<span class="text-muted">{option.votes}</span>
							</span>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	<div class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted">
		<span>{formatCount(total, 'chat.votes.one', 'chat.votes.many')}</span>
		{#if poll.closed}
			<span class="badge">{t('chat.pollClosed')}</span>
		{:else if myOption}
			<span>{t('chat.myVote', { option: myOption.label })}</span>
		{:else}
			<span>{t('chat.voteHint')}</span>
		{/if}
	</div>
</div>
