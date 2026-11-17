<script lang="ts">
	import type { ChatPollView } from '#lib/domain/chat/service.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import PollOptions from '#lib/ui/PollOptions.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';

	let {
		messageId,
		poll
	}: {
		messageId: string;
		poll: ChatPollView;
	} = $props();
</script>

<SectionCard title={t('chat.pollTag')}>
	<PollOptions {messageId} {poll} />
</SectionCard>
