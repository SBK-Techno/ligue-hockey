<script lang="ts">
		import { GAME_LIMITS } from '#lib/domain/games/validators.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
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
<section class="card mb-5" id="create-game">
	<h2 class="mb-3">{t('games.adminCreate')}</h2>
	<form method="POST" action="?/create" use:progressiveForm class="grid gap-3 sm:grid-cols-2">
		<div>
			<label class="label" for="gameDate">{t('games.date')}</label>
			<input class="input" id="gameDate" name="gameDate" type="date" value={data.defaults.date} required />
		</div>
		<div>
			<label class="label" for="startTime">{t('games.time')}</label>
			<input class="input" id="startTime" name="startTime" type="time" value={data.defaults.time} required />
		</div>
		<div class="sm:col-span-2">
			<label class="label" for="location">{t('games.location')}</label>
			<input class="input" id="location" name="location" value={data.defaults.location} maxlength={GAME_LIMITS.locationMax} required />
		</div>
		<div class="sm:col-span-2">
			<label class="label" for="notes">{t('games.notes')}</label>
			<textarea class="input" id="notes" name="notes" rows="2" maxlength={GAME_LIMITS.notesMax}></textarea>
		</div>
		<div class="sm:col-span-2">
			<button class="btn-primary" type="submit">{t('games.adminCreate')}</button>
		</div>
	</form>
</section>
{/if}

{#if data.games.length === 0}
	<div class="card">
		<p class="text-sm text-muted">{t('games.empty')}</p>
		<p class="hint">{t('games.emptyHelp')}</p>
	</div>
{:else}
	<div class="card-flush overflow-hidden">
		<ul role="list" class="divide-y divide-line/70">
			{#each data.games as game (game.id)}
				<li>
					<a
						class="flex min-h-14 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-ink/[0.03]"
						href="/admin/matchs/{game.id}"
					>
						<span class="w-16 shrink-0 whitespace-nowrap font-mono text-xs text-muted">
							{formatDate(game.gameDate, 'short')}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-semibold">
								{formatTime(game.startTime)} · {game.location}
							</span>
							<span class="mt-0.5 flex flex-wrap items-center gap-1.5">
								{#if game.status === 'cancelled'}
									<span class="badge-alert">{t('games.status.cancelled')}</span>
								{:else if game.generated}
									<span class="badge-ice">{t('games.generated')}</span>
								{:else}
									<span class="badge">{t('games.notGenerated')}</span>
								{/if}
								{#if game.generated && game.openSlots > 0}
									<span class="badge-alert">{game.openSlotsLabel}</span>
								{/if}
							</span>
						</span>
						<svg
							viewBox="0 0 24 24"
							class="h-4 w-4 shrink-0 text-muted"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path d="m9 6 6 6-6 6" />
						</svg>
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
