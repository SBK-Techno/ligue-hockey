<script lang="ts">
	import { can } from '#lib/domain/auth/policy.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import GameRow from '#lib/ui/GameRow.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const isManager = $derived(data.actor.kind === 'user' && can(data.actor, 'manageGames'));
	const visiblePast = $derived(data.past.slice(0, 6));
	const archivedPast = $derived(data.past.slice(6));

</script>

<PageHeader title={t('games.title')} meta={t('games.subtitle')}>
	{#snippet actions()}
		{#if isManager}
			<a class="btn-primary btn-sm" href="/admin/matchs">{t('games.adminCreate')}</a>
		{/if}
	{/snippet}
</PageHeader>

<div class="space-y-4">
	<SectionCard title="{t('games.upcoming')} ({data.upcoming.length})">
		{#if data.upcoming.length === 0}
			<div class="px-4 py-3">
				<p class="text-sm text-muted">{t('games.empty')}</p>
				<p class="hint">{isManager ? t('home.noGameHelpAdmin') : t('games.emptyHelp')}</p>
				{#if isManager}
					<a class="btn-primary btn-sm mt-3" href="/admin/matchs">{t('home.createGame')}</a>
				{/if}
			</div>
		{:else}
			<ul role="list" class="divide-y divide-line/70">
				{#each data.upcoming as game, index (game.id)}
					<li>
						{#if index === 0 && game.status === 'scheduled'}
							<div class="border-b border-line bg-ice/[0.04]">
								<GameRow {game} next />
							</div>
						{:else}
							<GameRow {game} />
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</SectionCard>

	{#if data.past.length > 0}
		<SectionCard title="{t('games.past')} ({data.past.length})">
			<ul role="list" class="divide-y divide-line/70">
				{#each visiblePast as game (game.id)}
					<li><GameRow {game} past /></li>
				{/each}
			</ul>
			{#if archivedPast.length > 0}
				<details class="group border-t border-line">
					<summary
						class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium text-muted transition-colors hover:bg-ink/[0.03] hover:text-ink"
					>
						{t('games.showArchive', { count: data.past.length })}
						<svg
							viewBox="0 0 24 24"
							class="h-4 w-4 transition-transform group-open:rotate-180"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path d="m6 9 6 6 6-6" />
						</svg>
					</summary>
					<ul role="list" class="divide-y divide-line/70 border-t border-line">
						{#each archivedPast as game (game.id)}
							<li><GameRow {game} past /></li>
						{/each}
					</ul>
				</details>
			{/if}
		</SectionCard>
	{/if}
</div>
