<script lang="ts">
	import { onMount } from 'svelte';
	import { refreshAll } from '$app/navigation';
	import { positionDefinition } from '#config/positions.ts';
	import { branding } from '#lib/generated/branding.ts';
	import { formatCount, formatDate, formatTimeOfDay, t } from '#lib/shared/i18n/index.ts';
	import { toDate, todayInZone } from '#lib/shared/time/clock.ts';
	import Avatar from '#lib/ui/Avatar.svelte';
	import PlayerName from '#lib/ui/PlayerName.svelte';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import PollOptions from '#lib/ui/PollOptions.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import { prefersReducedMotion, scrollBehavior } from '#lib/ui/scroll.ts';
	import { initialPillState, nextPillState } from '#lib/ui/chat-scroll.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let showPoll = $state(false);
	// Seeded once from the server limits; the user owns the list afterwards.
	// svelte-ignore state_referenced_locally
	let pollOptions = $state<string[]>(
		Array.from({ length: data.limits.pollMinOptions }, () => '')
	);

	const messages = $derived([...data.messages].reverse());
	const canAddOption = $derived(pollOptions.length < data.limits.pollMaxOptions);

	type DisplayMessage = (typeof data.messages)[number];
	type DayGroup = { key: string; label: string; messages: DisplayMessage[] };

	function dayLabel(key: string): string {
		if (key === data.today) return t('chat.today');
		if (key === data.yesterday) return t('chat.yesterday');
		return formatDate(key, 'long');
	}

	/** Le jour est écrit une fois; les messages gardent leur heure. */
	const groups = $derived.by<DayGroup[]>(() => {
		const result: DayGroup[] = [];
		for (const message of messages) {
			const key = todayInZone(branding.timezone, message.createdAt);
			let group = result.at(-1);
			if (!group || group.key !== key) {
				group = { key, label: dayLabel(key), messages: [] };
				result.push(group);
			}
			group.messages.push(message);
		}
		return result;
	});

	$effect(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') void refreshAll();
		}, 15_000);
		return () => clearInterval(timer);
	});

	// La page s'ouvre sur le dernier message, mais un lecteur qui remonte
	// l'historique n'est jamais ramené de force : un bouton l'avertit.
	const NEAR_BOTTOM_PX = 160;
	// svelte-ignore state_referenced_locally
	let pillState = $state(initialPillState(messages.length));

	function nearBottom(): boolean {
		const root = document.documentElement;
		return root.scrollHeight - window.scrollY - window.innerHeight < NEAR_BOTTOM_PX;
	}

	const scrollToLatest = () =>
		window.scrollTo({
			top: document.documentElement.scrollHeight,
			behavior: scrollBehavior(prefersReducedMotion())
		});

	onMount(() => {
		void document.fonts.ready.then(() =>
			requestAnimationFrame(() => {
				if (messages.length > 0) scrollToLatest();
			})
		);
	});

	$effect(() => {
		const count = messages.length;
		if (count > pillState.previousCount && nearBottom()) scrollToLatest();
		pillState = nextPillState(pillState, count, nearBottom());
	});

	function showNewMessages() {
		pillState = { ...pillState, newMessages: 0 };
		scrollToLatest();
	}

	function addOption() {
		pollOptions = [...pollOptions, ''];
	}

	function removeOption(index: number) {
		pollOptions = pollOptions.filter((_, current) => current !== index);
	}
</script>

{#if pillState.newMessages > 0}
	<div
		class="fixed inset-x-4 bottom-[calc(var(--bottom-bar-offset)+var(--bottom-bar-height))] z-30 mx-auto flex max-w-md justify-center lg:bottom-[var(--bottom-bar-offset)]"
	>
		<button class="btn-primary btn-sm" type="button" onclick={showNewMessages}>
			{formatCount(
				pillState.newMessages,
				'chat.newMessages.one',
				'chat.newMessages.many'
			)}
		</button>
	</div>
{/if}

<PageHeader title={t('chat.title')} meta={t('chat.subtitle')}>
	{#snippet actions()}
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
	{/snippet}
</PageHeader>

<div class="mt-5 space-y-4">
	<FormFeedback {form} />

	{#if showPoll}
		<div id="poll-form" class="max-w-2xl">
			<SectionCard title={t('chat.newPoll')}>
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
										class="btn-ghost btn-sm w-11 p-0"
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
			</SectionCard>
		</div>
	{/if}

	{#if messages.length === 0}
		<EmptyState title={t('chat.empty')} help={t('chat.emptyHelp')} />
	{:else}
		<section class="sheet" aria-label={t('chat.title')}>
			{#each groups as group (group.key)}
				<p
					class="border-b border-line bg-paper-deep/60 px-4 py-2 text-caption font-semibold text-muted"
				>
					{group.label}
				</p>
				<ul role="list">
					{#each group.messages as message (message.id)}
						<li class="chat-row" data-own={message.isOwn}>
							<div class="chat-avatar">
								<Avatar
									player={{
										fullName: message.authorName,
										userId: message.authorUserId,
										avatarId: message.authorAvatarId
									}}
									size={40}
								/>
							</div>

							<div class="chat-meta">
								<span class="flex min-w-0 items-center gap-1.5">
									<PlayerName playerId={message.authorUserId} name={message.authorName} class="truncate text-body font-semibold" />
									{#if message.isOwn}
										<span class="badge shrink-0">{t('chat.you')}</span>
									{/if}
								</span>
								<span class="flex flex-wrap items-center gap-1.5">
									{#if message.authorJerseyNumber !== null}
										<span
											class="grid h-5 min-w-6 place-items-center rounded-[0.25rem] bg-ice-soft px-1 font-mono text-caption font-semibold text-ice-deep"
											aria-label={t('chat.jersey', { number: message.authorJerseyNumber })}
										>
											{message.authorJerseyNumber}
										</span>
									{/if}
									{#if message.authorPosition}
										<span class="text-caption text-muted">
											{t(positionDefinition(message.authorPosition).shortLabelKey)}
										</span>
									{/if}
								</span>
								<time class="chat-time" datetime={toDate(message.createdAt).toISOString()}>
									{formatTimeOfDay(message.createdAt)}
								</time>
							</div>

							<div class="chat-body">
								{#if message.deleted}
									<p class="text-body italic text-muted">{t('chat.deleted')}</p>
								{:else if message.poll}
									<PollOptions messageId={message.id} poll={message.poll} />
								{:else}
									<p class="whitespace-pre-wrap break-words text-body">{message.body}</p>
								{/if}
							</div>

							{#if message.canDelete}
								<div class="absolute right-1 top-2">
									<details class="action-menu">
										<summary aria-label={t('chat.actions')}>
											<svg viewBox="0 0 20 20" class="h-5 w-5" aria-hidden="true">
												<circle cx="4" cy="10" r="1.5" fill="currentColor" />
												<circle cx="10" cy="10" r="1.5" fill="currentColor" />
												<circle cx="16" cy="10" r="1.5" fill="currentColor" />
											</svg>
										</summary>
										<div class="action-menu-panel">
											{#if message.poll && !message.poll.closed}
												<form method="POST" action="?/closePoll" use:progressiveForm>
													<input type="hidden" name="messageId" value={message.id} />
													<ConfirmSubmit
														label={t('chat.closePoll')}
														question={t('chat.closePollConfirm')}
														tone="neutral"
														class="btn-ghost btn-sm"
													/>
												</form>
											{/if}
											<form method="POST" action="?/delete" use:progressiveForm>
												<input type="hidden" name="messageId" value={message.id} />
												<ConfirmSubmit
													label={t('chat.delete')}
													question={t('chat.deleteConfirm')}
													class="btn-ghost btn-sm"
												/>
											</form>
										</div>
									</details>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/each}
		</section>
	{/if}

	<form
		method="POST"
		action="?/send"
		use:progressiveForm
		class="sticky bottom-[var(--bottom-bar-offset)] z-20 w-full max-w-3xl lg:bottom-4"
	>
		<label class="sr-only" for="chat-body">{t('chat.messageLabel')}</label>
		<div class="sheet flex items-end gap-2 p-2">
			<textarea
				id="chat-body"
				class="input min-h-11 min-w-0 flex-1 resize-none border-transparent bg-transparent"
				name="body"
				rows="1"
				placeholder={t('chat.placeholder')}
				required
				maxlength={data.limits.messageMax}
			></textarea>
			<button class="btn-primary" type="submit">{t('chat.send')}</button>
		</div>
	</form>
</div>
