<script lang="ts">
	import { can } from '#lib/domain/auth/policy.ts';
	import { formatCount, formatTimestamp, t } from '#lib/shared/i18n/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const isManager = $derived(data.actor.kind === 'user' && can(data.actor, 'viewAdmin'));
	const unreadIds = $derived(data.items.filter((item) => item.readAt === null).map((item) => item.id));
</script>

<PageHeader
	title={t('notifications.title')}
	meta={data.items.length === 0
		? undefined
		: data.unread === 0
			? t('notifications.noneUnread')
			: formatCount(
					data.unread,
					'notifications.unreadCount.one',
					'notifications.unreadCount.many'
				)}
>
	{#snippet actions()}
		<a class="btn-ghost btn-sm" href="/profil#notifications">{t('notifications.settings')}</a>
		{#if unreadIds.length > 0}
			<form method="POST" action="?/read" use:progressiveForm>
				{#each unreadIds as id (id)}
					<input type="hidden" name="ids" value={id} />
				{/each}
				<button class="btn-primary btn-sm" type="submit">{t('notifications.markAll')}</button>
			</form>
		{/if}
	{/snippet}
</PageHeader>

<div class="page-stack">
	<FormFeedback {form} />

	{#if data.items.length === 0}
		<EmptyState
			title={t('notifications.empty')}
			help={isManager ? t('notifications.emptyHelpAdmin') : t('notifications.emptyHelp')}
		/>
	{:else}
		<div class="card-flush overflow-hidden">
			<ul role="list" class="divide-y divide-line">
				{#each data.items as item (item.id)}
					<li>
						<form method="POST" action="?/open" use:progressiveForm>
							<input type="hidden" name="id" value={item.id} />
							<button
								type="submit"
								class="section-row flex min-h-14 w-full items-start gap-3 text-left transition-colors hover:bg-ice-soft/60 {item.readAt ===
								null
									? 'bg-ice-soft'
									: ''}"
							>
								<span
									aria-hidden="true"
									class="mt-1.5 h-2 w-2 shrink-0 rounded-pill {item.readAt === null
										? 'bg-accent'
										: 'bg-line-strong'}"
								></span>
								<span class="block min-w-0 flex-1">
									<span class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
										<span class="break-words text-body font-semibold text-ink">{item.title}</span>
										<span class="text-meta text-muted">{formatTimestamp(item.createdAt)}</span>
									</span>
									<span class="mt-0.5 line-clamp-2 break-words text-body leading-snug text-ink/75">
										{item.body}
									</span>
								</span>
								{#if item.readAt === null}
									<span class="sr-only">{t('notifications.unread')}</span>
								{/if}
							</button>
						</form>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
