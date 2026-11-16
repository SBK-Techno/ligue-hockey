<script lang="ts">
	import { enhance } from '$app/forms';
	import { PLAYER_LIMITS } from '#config/players.ts';
	import { POSITIONS, positionDefinition } from '#config/positions.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let showInvite = $state(false);
</script>

{#if form?.message}
	<p class="success mb-4">{form.message}</p>
{/if}

<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h2>{t('admin.players')}</h2>
		<p class="mt-1 text-sm text-muted">{data.players.length}</p>
	</div>
	<button class="btn-primary btn-sm" type="button" onclick={() => (showInvite = !showInvite)}>
		{t('admin.addPlayer')}
	</button>
</div>

{#if showInvite}
	<section class="card mb-5">
		<h3 class="mb-3">{t('admin.addPlayer')}</h3>
		<form method="POST" action="?/invite" use:enhance class="grid gap-4 sm:grid-cols-2">
			<div>
				<label class="label" for="firstName">{t('profile.firstName')}</label>
				<input
					class="input"
					id="firstName"
					name="firstName"
					required
					maxlength={PLAYER_LIMITS.nameMax}
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
				/>
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="email">{t('profile.email')}</label>
				<input
					class="input"
					id="email"
					name="email"
					type="email"
					required
					maxlength={PLAYER_LIMITS.emailMax}
				/>
			</div>
			<div>
				<label class="label" for="position">{t('profile.position')}</label>
				<select class="input" id="position" name="position">
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
					min={PLAYER_LIMITS.ageMin}
					max={PLAYER_LIMITS.ageMax}
					value={PLAYER_LIMITS.defaultAge}
					required
				/>
			</div>
			<label class="flex items-center gap-3 text-sm font-medium sm:col-span-2">
				<input type="checkbox" name="isSubstitute" class="h-4 w-4 accent-[var(--color-ice)]" />
				{t('profile.substitute')}
			</label>
			<div class="sm:col-span-2">
				<button class="btn-primary" type="submit">{t('admin.invite')}</button>
			</div>
		</form>
	</section>
{/if}

{#if data.players.length === 0}
	<div class="card text-sm text-muted">{t('admin.noPlayers')}</div>
{:else}
	<ul class="space-y-2">
		{#each data.players as player (player.userId)}
			<li class="card">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<a href="/admin/joueurs/{player.userId}" class="font-semibold text-ink">
								{player.fullName}
							</a>
							{#if player.role === 'admin'}
								<span class="badge-ice">{t('admin.role.admin')}</span>
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
						<p class="mt-1 text-sm text-muted">
							{player.email} · {t(positionDefinition(player.position).labelKey)} · {player.age}
							{t('common.years')}
						</p>
					</div>
					<div class="flex flex-wrap gap-1">
						<form method="POST" action="?/resend" use:enhance>
							<input type="hidden" name="playerId" value={player.userId} />
							<button class="btn-ghost btn-sm" type="submit">{t('admin.reinvite')}</button>
						</form>
						<form method="POST" action="?/substitute" use:enhance>
							<input type="hidden" name="playerId" value={player.userId} />
							<input type="hidden" name="value" value={player.isSubstitute ? 'false' : 'true'} />
							<button class="btn-ghost btn-sm" type="submit">
								{player.isSubstitute ? t('subs.remove') : t('subs.add')}
							</button>
						</form>
						{#if player.isSubstitute}
							<form method="POST" action="?/favorite" use:enhance>
								<input type="hidden" name="playerId" value={player.userId} />
								<input
									type="hidden"
									name="value"
									value={data.favorites.get(player.userId) ? 'false' : 'true'}
								/>
								<button class="btn-ghost btn-sm" type="submit">
									{t('subs.favorite')}
								</button>
							</form>
						{/if}
						<form method="POST" action="?/active" use:enhance>
							<input type="hidden" name="playerId" value={player.userId} />
							<input type="hidden" name="value" value={player.active ? 'false' : 'true'} />
							<button class="btn-ghost btn-sm" type="submit">
								{player.active ? t('admin.deactivate') : t('admin.activate')}
							</button>
						</form>
						<a class="btn-secondary btn-sm" href="/admin/joueurs/{player.userId}">
							{t('common.edit')}
						</a>
					</div>
				</div>
			</li>
		{/each}
	</ul>
{/if}
