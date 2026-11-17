<script lang="ts">
	import { GAME_LIMITS } from '#config/games.ts';
	import { formatCount, t } from '#lib/shared/i18n/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import GameRow from '#lib/ui/GameRow.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let showCreate = $state(false);
</script>

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

<div class="page-stack">
	<FormFeedback {form} />

	{#if showCreate}
		<SectionCard title={t('games.adminCreate')}>
			<div id="create-game">
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
						<label class="label" for="locationId">{t('games.location')}</label>
						<select
							class="input"
							id="locationId"
							name="locationId"
							value={data.defaults.locationId}
							required
						>
							{#if data.locations.length === 0}
								<option value="">{t('admin.locationNone')}</option>
							{/if}
							{#each data.locations as location (location.id)}
								<option value={location.id}>{location.name}</option>
							{/each}
						</select>
						{#if data.locations.length === 0}
							<p class="hint">
								{t('admin.locationCreateFirst')}
								<a class="link" href="/admin/lieux">{t('admin.addLocation')}</a>
							</p>
						{/if}
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
						<button class="btn-primary" type="submit" disabled={data.locations.length === 0}>
							{t('games.adminCreate')}
						</button>
					</div>
				</form>
			</div>
		</SectionCard>
	{/if}

	{#if data.upcoming.length === 0}
		<EmptyState title={t('games.empty')} help={t('games.emptyHelp')}>
			{#snippet action()}
				{#if !showCreate}
					<button class="btn-secondary" type="button" onclick={() => (showCreate = true)}>
						{t('games.adminCreate')}
					</button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<SectionCard title="{t('games.upcoming')} ({data.upcoming.length})" flush>
			<ul role="list" class="divide-y divide-line">
				{#each data.upcoming as game (game.id)}
					<li>
						{#if game.id === data.nextId}
							<div class="bg-ice-soft/60">
								<GameRow {game} context="admin" href="/admin/matchs/{game.id}" next />
							</div>
						{:else}
							<GameRow {game} context="admin" href="/admin/matchs/{game.id}" />
						{/if}
					</li>
				{/each}
			</ul>
		</SectionCard>
	{/if}

	{#if data.past.length > 0}
		<SectionCard
			title="{t('games.past')} ({data.past.length})"
			href={data.showArchive
				? '/admin/matchs'
				: data.pastTotal > data.past.length
					? '/admin/matchs?archive=1#archive'
					: undefined}
			linkLabel={data.showArchive
				? t('games.hideArchive')
				: data.pastTotal > data.past.length
					? formatCount(
							data.pastTotal,
							'games.showArchive.one',
							'games.showArchive.many'
						)
					: undefined}
			flush
		>
			<ul
				role="list"
				class="divide-y divide-line"
				id="archive"
			>
				{#each data.past as game (game.id)}
					<li>
						<GameRow {game} context="admin" href="/admin/matchs/{game.id}" past />
					</li>
				{/each}
			</ul>
		</SectionCard>
	{/if}
</div>
