<script lang="ts">
	import type { ChatPollView } from '#lib/domain/chat/service.ts';
	import { formatCount, t } from '#lib/shared/i18n/index.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	let {
		messageId,
		poll,
		action = '?/vote',
		showQuestion = true,
		class: className = ''
	}: {
		messageId: string;
		poll: ChatPollView;
		/** La même action `?/vote` sur la discussion et sur l'accueil. */
		action?: string;
		showQuestion?: boolean;
		class?: string;
	} = $props();
</script>

<div class={className}>
	{#if showQuestion}
		<p class="break-words font-semibold">{poll.question}</p>
	{/if}

	{#if poll.closed}
		<p class="badge mt-2">{t('chat.pollClosed')}</p>
	{/if}

	<ul role="list" class="mt-3 space-y-2">
		{#each poll.options as option (option.id)}
			<li>
				<form method="POST" {action} use:progressiveForm class="flex items-center gap-2">
					<input type="hidden" name="messageId" value={messageId} />
					<input type="hidden" name="optionId" value={option.id} />
					<button
						class="flex min-h-11 flex-1 items-center justify-between gap-3 rounded-control border px-3 py-2 text-left text-body transition-colors disabled:opacity-60 {option.myVote
							? 'border-ice bg-ice-soft font-semibold text-ice-deep'
							: 'border-line-strong bg-paper'}"
						type="submit"
						disabled={poll.closed}
						aria-pressed={option.myVote}
					>
						<span class="min-w-0 break-words">{option.label}</span>
						<span class="badge shrink-0">
							{formatCount(option.votes, 'chat.votes.one', 'chat.votes.many')}
						</span>
					</button>
				</form>
			</li>
		{/each}
	</ul>
</div>
