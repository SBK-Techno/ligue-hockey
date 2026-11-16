<script lang="ts">
	import { onMount } from 'svelte';
	import { refreshAll } from '$app/navigation';
	import { formatCount, formatTimestamp, t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let showPoll = $state(false);
	let bottom: HTMLDivElement | undefined = $state();
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

	onMount(() => {
		bottom?.scrollIntoView({ block: 'end' });
	});

	function addOption() {
		pollOptions = [...pollOptions, ''];
	}

	function removeOption(index: number) {
		pollOptions = pollOptions.filter((_, current) => current !== index);
	}
</script>

<FormFeedback
	{form}
	class="fixed inset-x-4 bottom-[calc(var(--bottom-bar-offset)+0.75rem)] z-40 mx-auto max-w-md shadow-lift lg:bottom-6"
/>

<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1>{t('chat.title')}</h1>
		<p class="mt-1.5 text-sm text-muted">{t('chat.subtitle')}</p>
	</div>
	{#if data.canCreatePoll}
		<button
			class="btn-secondary btn-sm"
			type="button"
			onclick={() => (showPoll = !showPoll)}
			aria-expanded={showPoll}
			aria-controls="poll-form"
		>
			{showPoll ? t('common.close') : t('chat.newPoll')}
		</button>
	{/if}
</div>

{#if showPoll}
	<section class="card mb-5" id="poll-form">
		<h2 class="mb-3">{t('chat.newPoll')}</h2>
		<form method="POST" action="?/poll" use:progressiveForm class="space-y-3">
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
			<fieldset class="space-y-2">
				<legend class="sr-only">{t('chat.pollOptions')}</legend>
				{#each pollOptions as option, index (index)}
					<div class="flex gap-2">
						<label class="sr-only" for="poll-option-{index}">
							{t('chat.optionNumber', { number: index + 1 })}
						</label>
						<input
							class="input"
							id="poll-option-{index}"
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
			</fieldset>
			<div class="flex flex-wrap gap-2">
				<button
					class="btn-secondary btn-sm"
					type="button"
					onclick={addOption}
					disabled={!canAddOption}
				>
					{t('chat.addOption')}
				</button>
				<button class="btn-primary btn-sm" type="submit">{t('chat.publishPoll')}</button>
			</div>
		</form>
	</section>
{/if}

{#if messages.length === 0}
	<div class="card">
		<p class="text-sm text-muted">{t('chat.empty')}</p>
		<p class="hint">{t('chat.emptyHelp')}</p>
	</div>
{:else}
	<ul role="list" class="space-y-3">
		{#each messages as message (message.id)}
			<li class="card">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="text-sm font-semibold">{message.authorName}</p>
						<p class="text-xs text-muted">{formatTimestamp(message.createdAt)}</p>
					</div>
					{#if message.canDelete}
						<form method="POST" action="?/delete" use:progressiveForm>
							<input type="hidden" name="messageId" value={message.id} />
							<ConfirmSubmit
								label={t('chat.delete')}
								question={t('chat.deleteConfirm')}
								class="btn-ghost btn-sm"
							/>
						</form>
					{/if}
				</div>

				{#if message.deleted}
					<p class="mt-3 text-sm italic text-muted">{t('chat.deleted')}</p>
				{:else if message.poll}
					<div class="mt-3">
						<p class="break-words font-semibold">{message.poll.question}</p>
						{#if message.poll.closed}
							<p class="badge mt-2">{t('chat.pollClosed')}</p>
						{/if}
						<ul role="list" class="mt-3 space-y-2">
							{#each message.poll.options as option (option.id)}
								<li>
									<form method="POST" action="?/vote" use:progressiveForm class="flex items-center gap-2">
										<input type="hidden" name="messageId" value={message.id} />
										<input type="hidden" name="optionId" value={option.id} />
										<button
											class="flex min-h-11 flex-1 items-center justify-between gap-3 rounded-control border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 {option.myVote
												? 'border-ice bg-ice-soft font-semibold text-ice-deep'
												: 'border-line bg-paper'}"
											type="submit"
											disabled={message.poll.closed}
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
						{#if message.canDelete && !message.poll.closed}
							<form method="POST" action="?/closePoll" use:progressiveForm class="mt-3">
								<input type="hidden" name="messageId" value={message.id} />
								<ConfirmSubmit
									label={t('chat.closePoll')}
									question={t('chat.closePollConfirm')}
									class="btn-ghost btn-sm"
								/>
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

<div bind:this={bottom}></div>

<form
	method="POST"
	action="?/send"
	use:progressiveForm
	class="sticky bottom-[var(--bottom-bar-offset)] mt-4 lg:bottom-4"
>
	<label class="sr-only" for="chat-body">{t('chat.messageLabel')}</label>
	<div class="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-card">
		<textarea
			id="chat-body"
			class="min-h-11 flex-1 resize-none rounded-control border-0 bg-transparent px-2 py-2 text-base text-ink outline-none placeholder:text-muted/70 focus-visible:ring-2 focus-visible:ring-ice"
			name="body"
			rows="1"
			placeholder={t('chat.placeholder')}
			required
			maxlength={data.limits.messageMax}
		></textarea>
		<button class="btn-primary" type="submit">{t('chat.send')}</button>
	</div>
</form>
