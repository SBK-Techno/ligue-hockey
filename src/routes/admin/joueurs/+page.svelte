<script lang="ts">
	import { PLAYER_LIMITS } from '#config/players.ts';
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { formatAge, formatCount, t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let showInvite = $state(false);
	let query = $state('');

	const filtered = $derived(
		data.players.filter((player) => {
			const needle = query.trim().toLowerCase();
			if (!needle) return true;
			return (
				player.fullName.toLowerCase().includes(needle) ||
				player.email.toLowerCase().includes(needle)
			);
		})
	);
</script>

<FormFeedback {form} class="mb-4" />

<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1>{t('admin.players')}</h1>
		<p class="mt-1.5 text-sm text-muted">
			{formatCount(
				data.players.length,
				'common.playerCount.one',
				'common.playerCount.many'
			)}
		</p>
	</div>
	<button
		class="btn-primary btn-sm"
		type="button"
		onclick={() => (showInvite = !showInvite)}
		aria-expanded={showInvite}
		aria-controls="invite-form"
	>
		{showInvite ? t('common.close') : t('admin.addPlayer')}
	</button>
</div>

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
					placeholder="30"
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
					placeholder="12"
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
	<div class="mb-3">
		<label class="sr-only" for="player-search">{t('admin.searchPlayers')}</label>
		<input
			class="input max-w-sm"
			id="player-search"
			type="search"
			placeholder={t('admin.searchPlayers')}
			bind:value={query}
		/>
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
	<ul role="list" class="space-y-2">
		{#each filtered as player (player.userId)}
			<li class="card">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<a href="/admin/joueurs/{player.userId}" class="font-semibold text-ink no-underline hover:underline">
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
						<p class="mt-1 break-words text-sm text-muted">
							<span class="break-all">{player.email}</span> ·
							{t(positionDefinition(player.position).labelKey)} · {formatAge(player.age)}
						</p>
					</div>
					<div class="flex flex-wrap gap-1">
						<a class="btn-secondary btn-sm" href="/admin/joueurs/{player.userId}">
							{t('common.edit')}
						</a>
						<form method="POST" action="?/resend" use:progressiveForm>
							<input type="hidden" name="playerId" value={player.userId} />
							<button class="btn-ghost btn-sm" type="submit">{t('admin.resetPassword')}</button>
						</form>
						<form method="POST" action="?/substitute" use:progressiveForm>
							<input type="hidden" name="playerId" value={player.userId} />
							<input type="hidden" name="value" value={player.isSubstitute ? 'false' : 'true'} />
							<button class="btn-ghost btn-sm" type="submit">
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
								<button class="btn-ghost btn-sm" type="submit">
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
									class="btn-ghost btn-sm"
								/>
							</form>
						{:else}
							<form method="POST" action="?/active" use:progressiveForm>
								<input type="hidden" name="playerId" value={player.userId} />
								<input type="hidden" name="value" value="true" />
								<button class="btn-ghost btn-sm" type="submit">{t('admin.activate')}</button>
							</form>
						{/if}
					</div>
				</div>
			</li>
		{/each}
	</ul>
{/if}
