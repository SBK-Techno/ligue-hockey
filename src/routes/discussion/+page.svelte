<script lang="ts">
	import { enhance } from '$app/forms';
	import { refreshAll } from '$app/navigation';
	import { formatCount, formatTimestamp, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let showPoll = $state(false);
	// Seeded once from the server limits; the user owns the list afterwards.
	// svelte-ignore state_referenced_locally
	let pollOptions = $state<string[]>(
		Array.from({ length: data.limits.pollMinOptions }, () => '')
	);

	const messages = $derived([...data.messages].reverse());
	const canAddOption = $derived(
		pollOptions.length < data.limits.pollMaxOptions
	);

	$effect(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') void refreshAll();
		}, 15_000);
		return () => clearInterval(timer);
	});

	function addOption() {
		pollOptions = [...pollOptions, ''];
	}

	function removeOption(index: number) {
		pollOptions = pollOptions.filter((_, current) => current !== index);
	}
</script>

{#if form?.message}
	<p class="success mb-4">{form.message}</p>
{/if}

<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1>{t('chat.title')}</h1>
		<p class="mt-1 text-sm text-muted">{t('chat.subtitle')}</p>
	</div>
	<button class="btn-secondary btn-sm" type="button" onclick={() => (showPoll = !showPoll)}>
		{t('chat.newPoll')}
	</button>
</div>

{#if showPoll}
	<section class="card mb-5">
		<h2 class="mb-3">{t('chat.newPoll')}</h2>
		<form method="POST" action="?/poll" use:enhance class="space-y-3">
			<div>
				<label class="label" for="question">{t('chat.pollQuestion')}</label>
				<input
					class="input"
					id="question"
					name="question"
					required
					maxlength={data.limits.questionMax}
				/>
			</div>
			<div class="space-y-2">
				{#each pollOptions as option, index (index)}
					<div class="flex gap-2">
						<input
							class="input"
							name="options"
							placeholder={option || t('chat.pollOptions')}
							required={index < data.limits.pollMinOptions}
							maxlength={data.limits.optionMax}
							bind:value={pollOptions[index]}
						/>
						{#if pollOptions.length > data.limits.pollMinOptions}
							<button
								class="btn-ghost btn-sm"
								type="button"
								onclick={() => removeOption(index)}
								aria-label={t('common.delete')}
							>
								×
							</button>
						{/if}
					</div>
				{/each}
			</div>
			<div class="flex flex-wrap gap-2">
				<button
					class="btn-secondary btn-sm"
					type="button"
					onclick={addOption}
					disabled={!canAddOption}
				>
					{t('chat.addOption')}
				</button>
				<button class="btn-primary btn-sm" type="submit">{t('chat.newPoll')}</button>
			</div>
		</form>
	</section>
{/if}

{#if messages.length === 0}
	<div class="card text-sm text-muted">{t('chat.empty')}</div>
{:else}
	<ul class="space-y-3">
		{#each messages as message (message.id)}
			<li class="card">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="text-sm font-semibold">{message.authorName}</p>
						<p class="text-xs text-muted">{formatTimestamp(message.createdAt)}</p>
					</div>
					{#if message.canDelete}
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="messageId" value={message.id} />
							<button class="btn-ghost btn-sm" type="submit">{t('chat.delete')}</button>
						</form>
					{/if}
				</div>

				{#if message.deleted}
					<p class="mt-3 text-sm italic text-muted">{t('chat.deleted')}</p>
				{:else if message.poll}
					<div class="mt-3">
						<p class="font-semibold">{message.poll.question}</p>
						{#if message.poll.closed}
							<p class="badge mt-2">{t('chat.pollClosed')}</p>
						{/if}
						<ul class="mt-3 space-y-2">
							{#each message.poll.options as option (option.id)}
								<li>
									<form method="POST" action="?/vote" use:enhance class="flex items-center gap-2">
										<input type="hidden" name="messageId" value={message.id} />
										<input type="hidden" name="optionId" value={option.id} />
										<button
											class="flex min-h-10 flex-1 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm {option.myVote
												? 'border-ice bg-ice-soft font-semibold text-ice-deep'
												: 'border-line bg-paper'}"
											type="submit"
											disabled={message.poll.closed}
										>
											<span>{option.label}</span>
											<span class="badge">
												{formatCount(option.votes, 'chat.votes.one', 'chat.votes.many')}
											</span>
										</button>
									</form>
								</li>
							{/each}
						</ul>
						{#if message.canDelete && !message.poll.closed}
							<form method="POST" action="?/closePoll" use:enhance class="mt-3">
								<input type="hidden" name="messageId" value={message.id} />
								<button class="btn-ghost btn-sm" type="submit">{t('chat.closePoll')}</button>
							</form>
						{/if}
					</div>
				{:else}
					<p class="mt-3 whitespace-pre-wrap break-words text-sm">{message.body}</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<form method="POST" action="?/send" use:enhance class="sticky bottom-20 mt-4 sm:bottom-4">
	<div class="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-lg">
		<textarea
			class="input min-h-11 resize-none border-0 bg-transparent focus:ring-0"
			name="body"
			rows="1"
			placeholder={t('chat.placeholder')}
			required
			maxlength={data.limits.messageMax}
		></textarea>
		<button class="btn-primary" type="submit">{t('chat.send')}</button>
	</div>
</form>
