<script lang="ts">
	import { GAME_LIMITS } from '#lib/domain/games/validators.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import GameRow from '#lib/ui/GameRow.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let showCreate = $state(false);

</script>

<FormFeedback {form} class="mb-4" />

<PageHeader title={t('admin.games')} meta={t('admin.gamesHelp')}>
	{#snippet actions()}
		<button
			class="btn-primary btn-sm"
			type="button"
			aria-expanded={showCreate}
			aria-controls="create-game"
			onclick={() => (showCreate = !showCreate)}
		>
			{showCreate ? t('common.close') : t('games.adminCreate')}
		</button>
	{/snippet}
</PageHeader>

{#if showCreate}
	<section class="sheet mb-4 p-4" id="create-game">
		<form method="POST" action="?/create" use:progressiveForm class="grid gap-3 sm:grid-cols-2">
			<div>
				<label class="label" for="gameDate">{t('games.date')}</label>
				<input
					class="input"
					id="gameDate"
					name="gameDate"
					type="date"
					value={data.defaults.date}
					required
				/>
			</div>
			<div>
				<label class="label" for="startTime">{t('games.time')}</label>
				<input
					class="input"
					id="startTime"
					name="startTime"
					type="time"
					value={data.defaults.time}
					required
				/>
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="location">{t('games.location')}</label>
				<input
					class="input"
					id="location"
					name="location"
					value={data.defaults.location}
					maxlength={GAME_LIMITS.locationMax}
					required
				/>
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="notes">{t('games.notes')}</label>
				<textarea
					class="input"
					id="notes"
					name="notes"
					rows="2"
					maxlength={GAME_LIMITS.notesMax}
				></textarea>
			</div>
			<div class="sm:col-span-2">
				<button class="btn-primary" type="submit">{t('games.adminCreate')}</button>
			</div>
		</form>
	</section>
{/if}

<div class="space-y-4">
	<SectionCard
		title="{t('games.upcoming')} ({data.upcoming.length})"
	>
		{#if data.upcoming.length === 0}
			<div class="px-4 py-3">
				<p class="text-sm text-muted">{t('games.empty')}</p>
				<p class="hint">{t('games.emptyHelp')}</p>
			</div>
		{:else}
			<ul role="list" class="divide-y divide-line/70">
				{#each data.upcoming as game, index (game.id)}
					<li>
						{#if index === 0 && game.status === 'scheduled'}
							<div class="border-b border-line bg-ice/[0.04]">
								<GameRow
									{game}
									context="admin"
									href="/admin/matchs/{game.id}"
									next
								/>
							</div>
						{:else}
							<GameRow {game} context="admin" href="/admin/matchs/{game.id}" />
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</SectionCard>

	{#if data.past.length > 0}
		<SectionCard
			title="{t('games.past')} ({data.pastTotal})"
			href={data.showArchive
				? '/admin/matchs'
				: data.pastTotal > data.past.length
					? '/admin/matchs?archive=1#archive'
					: undefined}
			linkLabel={data.showArchive
				? t('games.hideArchive')
				: data.pastTotal > data.past.length
					? t('games.showArchive', { count: data.pastTotal })
					: undefined}
		>
			<ul
				role="list"
				class="scroll-mt-[calc(var(--anchor-offset)+0.5rem)] divide-y divide-line/70"
				id="archive"
			>
				{#each data.past as game (game.id)}
					<li>
						<GameRow
							{game}
							context="admin"
							href="/admin/matchs/{game.id}"
							past
						/>
					</li>
				{/each}
			</ul>
		</SectionCard>
	{/if}
</div>
