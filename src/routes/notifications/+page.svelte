<script lang="ts">
	import { formatCount, formatTimestamp, t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const unreadIds = $derived(data.items.filter((item) => item.readAt === null).map((item) => item.id));
</script>

<FormFeedback {form} class="mb-4" />

<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1>{t('notifications.title')}</h1>
		<p class="mt-1.5 text-sm text-muted">
			{#if data.unread === 0}
				{t('notifications.noneUnread')}
			{:else}
				{formatCount(
					data.unread,
					'notifications.unreadCount.one',
					'notifications.unreadCount.many'
				)}
			{/if}
		</p>
	</div>
	{#if unreadIds.length > 0}
		<form method="POST" action="?/read" use:progressiveForm>
			{#each unreadIds as id (id)}
				<input type="hidden" name="ids" value={id} />
			{/each}
			<button class="btn-secondary btn-sm" type="submit">{t('notifications.markAll')}</button>
		</form>
	{/if}
</div>

{#if data.items.length === 0}
	<div class="card">
		<p class="text-sm text-muted">{t('notifications.empty')}</p>
		<p class="hint">{t('notifications.emptyHelp')}</p>
	</div>
{:else}
	<ul role="list" class="space-y-2">
		{#each data.items as item (item.id)}
			<li>
				<form method="POST" action="?/open" use:progressiveForm>
					<input type="hidden" name="id" value={item.id} />
					<button
						type="submit"
						class="block w-full rounded-control border px-4 py-3 text-left transition-colors {item.readAt ===
						null
							? 'border-ice/25 bg-ice-soft hover:border-ice/50'
							: 'border-line bg-surface hover:border-ink/25'}"
					>
						<span class="flex items-start justify-between gap-3">
							<span class="block">
								<span class="block text-sm font-semibold text-ink">{item.title}</span>
								<span class="mt-1 block text-sm leading-relaxed text-ink/80">{item.body}</span>
							</span>
							{#if item.readAt === null}
								<span class="badge-ice shrink-0">{t('notifications.unread')}</span>
							{/if}
						</span>
						<span class="mt-2 block text-xs text-muted">{formatTimestamp(item.createdAt)}</span>
					</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
