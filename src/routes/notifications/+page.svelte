<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCount, formatTimestamp, t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const unreadIds = $derived(data.items.filter((item) => item.readAt === null).map((item) => item.id));
</script>

{#if form?.message}
	<p class="success mb-4">{form.message}</p>
{/if}

<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1>{t('notifications.title')}</h1>
		<p class="mt-1 text-sm text-muted">
			{formatCount(
				data.unread,
				'notifications.unreadCount.one',
				'notifications.unreadCount.many'
			)}
		</p>
	</div>
	{#if unreadIds.length > 0}
		<form method="POST" action="?/read" use:enhance>
			{#each unreadIds as id (id)}
				<input type="hidden" name="ids" value={id} />
			{/each}
			<button class="btn-secondary btn-sm" type="submit">{t('common.saved')}</button>
		</form>
	{/if}
</div>

{#if data.items.length === 0}
	<div class="card text-sm text-muted">{t('notifications.empty')}</div>
{:else}
	<ul class="space-y-2">
		{#each data.items as item (item.id)}
			<li>
				<a
					href={item.url}
					class="block rounded-xl border px-4 py-3 no-underline {item.readAt === null
						? 'border-ice/30 bg-ice-soft'
						: 'border-line bg-surface'}"
				>
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-sm font-semibold text-ink">{item.title}</p>
							<p class="mt-1 text-sm text-ink/80">{item.body}</p>
						</div>
						{#if item.readAt === null}
							<span class="badge-ice">{t('notifications.unread')}</span>
						{/if}
					</div>
					<p class="mt-2 text-xs text-muted">{formatTimestamp(item.createdAt)}</p>
				</a>
			</li>
		{/each}
	</ul>
{/if}
