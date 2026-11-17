<script lang="ts">
	import type { ChatMessageView } from '#lib/domain/chat/service.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import { chatControlName } from '#lib/ui/chat-controls.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	/**
	 * Le menu d'une ligne et celui d'un sondage dans la colonne sont le même
	 * geste : fermer un sondage, supprimer un message. Le propriétaire unique
	 * garde les noms accessibles et la confirmation identiques partout.
	 */
	let {
		message,
		onsuccess,
		class: className = ''
	}: {
		message: ChatMessageView;
		onsuccess?: () => void;
		class?: string;
	} = $props();

	async function confirmSubmit(
		event: MouseEvent & { currentTarget: HTMLButtonElement },
		question: string,
		tone: 'danger' | 'neutral'
	) {
		const { askConfirm } = await import('#lib/ui/confirm.svelte.ts');
		const confirmed = await askConfirm({
			title: t('common.confirm'),
			question,
			confirmLabel: t('common.confirm'),
			cancelLabel: t('common.cancel'),
			tone
		});
		if (confirmed) event.currentTarget.form?.requestSubmit();
	}
</script>

<details class="action-menu {className}">
	<summary
		aria-label={chatControlName({
			kind: 'message',
			author: message.authorName,
			body: message.body,
			question: message.poll?.question
		})}
	>
		<svg viewBox="0 0 20 20" class="h-5 w-5" aria-hidden="true">
			<circle cx="4" cy="10" r="1.5" fill="currentColor" />
			<circle cx="10" cy="10" r="1.5" fill="currentColor" />
			<circle cx="16" cy="10" r="1.5" fill="currentColor" />
		</svg>
	</summary>
	<div class="action-menu-panel">
		{#if message.poll && !message.poll.closed}
			<form method="POST" action="?/closePoll" use:progressiveForm={{ onSuccess: onsuccess }}>
				<input type="hidden" name="messageId" value={message.id} />
				<button
					class="btn-ghost btn-sm"
					type="button"
					onclick={(event) => confirmSubmit(event, t('chat.closePollConfirm'), 'neutral')}
				>
					{t('chat.closePoll')}
				</button>
			</form>
		{/if}
		<form method="POST" action="?/delete" use:progressiveForm={{ onSuccess: onsuccess }}>
			<input type="hidden" name="messageId" value={message.id} />
			<button
				class="btn-ghost btn-sm"
				type="button"
				onclick={(event) => confirmSubmit(event, t('chat.deleteConfirm'), 'danger')}
			>
				{t('chat.delete')}
			</button>
		</form>
	</div>
</details>
