<script lang="ts">
	import type { ChatMessageView } from '#lib/domain/chat/service.ts';
	import { formatTimestamp, t } from '#lib/shared/i18n/index.ts';
	import Avatar from '#lib/ui/Avatar.svelte';
	import PollOptions from '#lib/ui/PollOptions.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';

	let { message }: { message: ChatMessageView } = $props();
</script>

<SectionCard title={t('home.chatPreview')}>
	<p class="flex min-w-0 items-center gap-2 text-meta text-muted">
		<Avatar
			player={{
				fullName: message.authorName,
				userId: message.authorUserId,
				avatarId: message.authorAvatarId
			}}
			size={24}
		/>
		<span class="min-w-0 break-words">
			{message.authorName} · {formatTimestamp(message.createdAt)}
		</span>
	</p>

	{#if message.deleted}
		<p class="mt-1.5 text-body italic text-muted">{t('chat.deleted')}</p>
	{:else if message.poll}
		<div class="mt-1.5">
			<PollOptions messageId={message.id} poll={message.poll} />
		</div>
	{:else}
		<p class="mt-1.5 whitespace-pre-wrap break-words text-body">{message.body}</p>
	{/if}

	<a class="action-link mt-2 text-body" href="/discussion">{t('home.openDiscussion')}</a>
</SectionCard>
