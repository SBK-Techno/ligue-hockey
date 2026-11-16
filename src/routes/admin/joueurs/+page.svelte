<script lang="ts">
	import { PLAYER_LIMITS } from '#config/players.ts';
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { formatAge, formatCount, t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let showInvite = $state(false);
	let query = $state('');
	type Filter = 'all' | 'active' | 'subs' | 'inactive';
	let filter = $state<Filter>('all');

	const filtered = $derived(
		data.players.filter((player) => {
			const needle = query.trim().toLowerCase();
			const matchesQuery =
				!needle ||
				player.fullName.toLowerCase().includes(needle) ||
				player.email.toLowerCase().includes(needle);
			const matchesFilter =
				filter === 'all' ||
				(filter === 'active' && player.active) ||
				(filter === 'subs' && player.active && player.isSubstitute) ||
				(filter === 'inactive' && !player.active);
			return matchesQuery && matchesFilter;
		})
	);

	const filters = [
		{ key: 'all' as const, labelKey: 'admin.filterAll' as const },
		{ key: 'active' as const, labelKey: 'admin.filterActive' as const },
		{ key: 'subs' as const, labelKey: 'admin.filterSubs' as const },
		{ key: 'inactive' as const, labelKey: 'admin.filterInactive' as const }
	];
</script>

<FormFeedback {form} class="mb-4" />

<PageHeader
	title={t('admin.players')}
	meta={formatCount(data.players.length, 'common.playerCount.one', 'common.playerCount.many')}
>
	{#snippet actions()}
		<button
			class="btn-primary btn-sm"
			type="button"
			onclick={() => (showInvite = !showInvite)}
			aria-expanded={showInvite}
			aria-controls="invite-form"
		>
			{showInvite ? t('common.close') : t('admin.addPlayer')}
		</button>
	{/snippet}
</PageHeader>

{#if showInvite}
	<section class="card mb-5" id="invite-form">
		<h2 class="mb-3">{t('admin.addPlayer')}</h2>
		<form method="POST" action="?/invite" use:progressiveForm class="grid gap-4 sm:grid-cols-2">
			<div>
				<label class="label" for="firstName">{t('profile.firstName')}</label>
				<input
					class="input"
					id="firstName"
					name="firstName"
					required
					maxlength={PLAYER_LIMITS.nameMax}
					autocomplete="given-name"
				/>
			</div>
			<div>
				<label class="label" for="lastName">{t('profile.lastName')}</label>
				<input
					class="input"
					id="lastName"
					name="lastName"
					required
					maxlength={PLAYER_LIMITS.nameMax}
					autocomplete="family-name"
				/>
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="email">{t('profile.email')}</label>
				<input
					class="input"
					id="email"
					name="email"
					type="email"
					inputmode="email"
					autocomplete="email"
					autocapitalize="none"
					spellcheck="false"
					required
					maxlength={PLAYER_LIMITS.emailMax}
				/>
				<p class="hint">{t('admin.emailHint')}</p>
			</div>
			<div>
				<label class="label" for="position">{t('profile.position')}</label>
				<select class="input" id="position" name="position" required>
					<option value="">{t('admin.choosePosition')}</option>
					{#each POSITIONS as position (position.key)}
						<option value={position.key}>{t(position.labelKey)}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="label" for="age">{t('profile.age')}</label>
				<input
					class="input"
					id="age"
					name="age"
					type="number"
					inputmode="numeric"
					min={PLAYER_LIMITS.ageMin}
					max={PLAYER_LIMITS.ageMax}
					placeholder={String(PLAYER_LIMITS.defaultAge)}
					required
				/>
				<p class="hint">{t('admin.ageHint')}</p>
			</div>
			<div>
				<label class="label" for="jerseyNumber">{t('admin.jerseyNumber')}</label>
				<input
					class="input"
					id="jerseyNumber"
					name="jerseyNumber"
					type="number"
					inputmode="numeric"
					min={PLAYER_LIMITS.jerseyMin}
					max={PLAYER_LIMITS.jerseyMax}
					placeholder={String(PLAYER_LIMITS.jerseyExample)}
				/>
			</div>
			<label class="flex min-h-11 items-center gap-3 text-sm font-medium sm:col-span-2">
				<input type="checkbox" name="isSubstitute" class="h-4 w-4" />
				{t('profile.substitute')}
			</label>
			<div class="sm:col-span-2">
				<button class="btn-primary" type="submit">{t('admin.invite')}</button>
			</div>
		</form>
	</section>
{/if}

{#if data.players.length > 0}
	<div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
		<label class="sr-only" for="player-search">{t('admin.searchPlayers')}</label>
		<input
			class="input sm:max-w-xs"
			id="player-search"
			type="search"
			placeholder={t('admin.searchPlayers')}
			bind:value={query}
		/>
		<div class="flex flex-wrap gap-1">
			{#each filters as option (option.key)}
				<button
					type="button"
					class="min-h-11 rounded-control border px-2.5 text-[13px] font-medium transition-colors {filter ===
					option.key
						? 'border-ochre bg-ochre/10 text-ink'
						: 'border-line-strong bg-surface text-muted hover:bg-paper'}"
					aria-pressed={filter === option.key}
					onclick={() => (filter = option.key)}
				>
					{t(option.labelKey)}
				</button>
			{/each}
		</div>
		{#if filter !== 'all' || query.trim()}
			<p class="ml-auto text-xs text-muted" aria-live="polite">
				{formatCount(filtered.length, 'common.playerCount.one', 'common.playerCount.many')}
			</p>
		{/if}
	</div>
{/if}

{#if data.players.length === 0}
	<div class="card">
		<p class="text-sm text-muted">{t('admin.noPlayers')}</p>
	</div>
{:else if filtered.length === 0}
	<div class="card">
		<p class="text-sm text-muted">{t('admin.noResults')}</p>
	</div>
{:else}
	<div class="card-flush overflow-hidden">
		<ul role="list" class="divide-y divide-line/70">
			{#each filtered as player (player.userId)}
				<li class="flex min-h-14 items-center gap-3 px-4 py-2.5">
					<span class="w-7 shrink-0 text-right font-mono text-[11px] text-muted">
						{player.jerseyNumber ?? '–'}
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
							<a
								href="/admin/joueurs/{player.userId}"
								class="min-w-0 truncate font-semibold text-ink no-underline hover:underline"
							>
								{player.fullName}
							</a>
							{#if player.role !== 'player'}
								<span class="badge-ice">
									{t(player.role === 'admin' ? 'admin.role.admin' : 'admin.role.manager')}
								</span>
							{/if}
							{#if player.isSubstitute}
								<span class="badge">{t('profile.substitute')}</span>
							{/if}
							{#if data.favorites.get(player.userId)}
								<span class="badge-ice">{t('subs.favorite')}</span>
							{/if}
							{#if !player.active}
								<span class="badge-alert">{t('admin.status.inactive')}</span>
							{/if}
						</div>
						<p class="mt-0.5 truncate text-xs text-muted">
							{t(positionDefinition(player.position).labelKey)} · {formatAge(player.age)}
						</p>
					</div>
					<a class="btn-ghost btn-sm hidden shrink-0 sm:inline-flex" href="/admin/joueurs/{player.userId}">
						{t('common.edit')}
					</a>
					<details class="group relative shrink-0">
						<summary
							class="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-control border border-line-strong bg-surface text-muted marker:content-none hover:bg-paper"
							aria-label={t('admin.moreActions')}
						>
							<svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
								<circle cx="5" cy="12" r="1.6" />
								<circle cx="12" cy="12" r="1.6" />
								<circle cx="19" cy="12" r="1.6" />
							</svg>
						</summary>
						<div
							class="absolute right-0 top-[calc(100%+0.35rem)] z-20 w-52 rounded-sheet border border-line bg-surface p-1 shadow-lift"
						>
							<a
								class="flex min-h-11 items-center rounded-control px-2.5 text-sm font-medium no-underline hover:bg-ink/5 sm:hidden"
								href="/admin/joueurs/{player.userId}"
							>
								{t('common.edit')}
							</a>
							<form method="POST" action="?/resend" use:progressiveForm>
								<input type="hidden" name="playerId" value={player.userId} />
								<button class="flex min-h-11 w-full items-center rounded-control px-2.5 text-left text-sm font-medium hover:bg-ink/5" type="submit">
									{t('admin.resetPassword')}
								</button>
							</form>
							<form method="POST" action="?/substitute" use:progressiveForm>
								<input type="hidden" name="playerId" value={player.userId} />
								<input type="hidden" name="value" value={player.isSubstitute ? 'false' : 'true'} />
								<button class="flex min-h-11 w-full items-center rounded-control px-2.5 text-left text-sm font-medium hover:bg-ink/5" type="submit">
									{player.isSubstitute ? t('admin.removeSub') : t('admin.addSub')}
								</button>
							</form>
							{#if player.isSubstitute}
								<form method="POST" action="?/favorite" use:progressiveForm>
									<input type="hidden" name="playerId" value={player.userId} />
									<input
										type="hidden"
										name="value"
										value={data.favorites.get(player.userId) ? 'false' : 'true'}
									/>
									<button class="flex min-h-11 w-full items-center rounded-control px-2.5 text-left text-sm font-medium hover:bg-ink/5" type="submit">
										{data.favorites.get(player.userId)
											? t('subs.removeFavorite')
											: t('subs.addFavorite')}
									</button>
								</form>
							{/if}
							{#if player.active}
								<form method="POST" action="?/active" use:progressiveForm>
									<input type="hidden" name="playerId" value={player.userId} />
									<input type="hidden" name="value" value="false" />
									<ConfirmSubmit
										label={t('admin.deactivate')}
										question={t('admin.deactivateConfirm', { name: player.fullName })}
										class="flex min-h-11 w-full items-center rounded-control px-2.5 text-left text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink"
									/>
								</form>
							{:else}
								<form method="POST" action="?/active" use:progressiveForm>
									<input type="hidden" name="playerId" value={player.userId} />
									<input type="hidden" name="value" value="true" />
									<button class="flex min-h-11 w-full items-center rounded-control px-2.5 text-left text-sm font-medium hover:bg-ink/5" type="submit">
										{t('admin.activate')}
									</button>
								</form>
							{/if}
						</div>
					</details>
				</li>
			{/each}
		</ul>
	</div>
{/if}
