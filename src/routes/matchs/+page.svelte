<script lang="ts">
	import { can } from '#lib/domain/auth/policy.ts';
	import { formatCount, t } from '#lib/shared/i18n/index.ts';
	import GameRow from '#lib/ui/GameRow.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const isManager = $derived(data.actor.kind === 'user' && can(data.actor, 'manageGames'));
	const visiblePast = $derived(data.past.slice(0, 6));
	const archivedPast = $derived(data.past.slice(6));
	let archiveOpen = $state(false);

</script>

<PageHeader title={t('games.title')} meta={t('games.subtitle')}>
	{#snippet actions()}
		{#if isManager}
			<a class="btn-primary btn-sm" href="/admin/matchs">{t('games.adminCreate')}</a>
		{/if}
	{/snippet}
</PageHeader>

<div class="page-stack">
	<SectionCard title="{t('games.upcoming')} ({data.upcoming.length})" flush>
		{#if data.upcoming.length === 0}
			<div class="section-body">
				<EmptyState title={t('games.empty')} help={isManager ? t('home.noGameHelpAdmin') : t('games.emptyHelp')}>
					{#snippet action()}
						{#if isManager}
							<a class="btn-primary btn-sm" href="/admin/matchs">{t('home.createGame')}</a>
						{/if}
					{/snippet}
				</EmptyState>
			</div>
		{:else}
			<ul role="list" class="divide-y divide-line">
				{#each data.upcoming as game (game.id)}
					<li>
						{#if game.id === data.nextId}
							<div class="bg-ice-soft/40">
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
		<SectionCard title="{t('games.past')} ({data.past.length})" flush>
			<ul role="list" class="divide-y divide-line">
				{#each visiblePast as game (game.id)}
					<li><GameRow {game} past /></li>
				{/each}
			</ul>
			{#if archivedPast.length > 0}
				<details class="group border-t border-line" bind:open={archiveOpen}>
					<summary
						class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-body font-medium text-muted transition-colors hover:bg-ice-soft/60 hover:text-ink"
					>
						{archiveOpen
							? t('games.hideArchive')
							: formatCount(
									archivedPast.length,
									'games.showArchive.one',
									'games.showArchive.many'
								)}
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
					<ul role="list" class="divide-y divide-line border-t border-line">
						{#each archivedPast as game (game.id)}
							<li><GameRow {game} past /></li>
						{/each}
					</ul>
				</details>
			{/if}
		</SectionCard>
	{/if}
</div>
