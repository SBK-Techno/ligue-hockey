<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { I18nKey } from '#config/i18n/fr.ts';
	import { roleDefinition } from '#config/roles.ts';
	import { positionDefinition } from '#config/positions.ts';
	import { formatAge, formatCount, t } from '#lib/shared/i18n/index.ts';
	import Avatar from '#lib/ui/Avatar.svelte';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FilterChips from '#lib/ui/FilterChips.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import InvitePlayerForm from '#lib/ui/InvitePlayerForm.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import {
		PLAYER_FILTERS,
		playerFiltersUrl,
		readPlayerFilters,
		type PlayerFilter
	} from './filters.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let showInvite = $state(false);
	// La recherche et la puce appartiennent à l'URL : le retour du navigateur
	// les restitue sans état local à resynchroniser.
	const filters = $derived(readPlayerFilters(page.url.searchParams));
	const query = $derived(filters.query);
	const filter = $derived(filters.filter);

	const filterLabels: Record<PlayerFilter, I18nKey> = {
		all: 'admin.filterAll',
		active: 'admin.filterActive',
		subs: 'admin.filterSubs',
		inactive: 'admin.filterInactive'
	};

	function setFilters(next: { query?: string; filter?: PlayerFilter }): void {
		const url = playerFiltersUrl(page.url.href, {
			query: next.query ?? query,
			filter: next.filter ?? filter
		});
		// La route est fixe; seuls les paramètres changent. resolve() valide la route,
		// et la requête vient de page.url : le lint ne sait pas lire cette composition.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		replaceState(`${resolve('/admin/joueurs')}${url.search}`, {});
	}

	const filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return data.players.filter((player) => {
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
		});
	});

</script>

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

<div class="page-stack">
	<FormFeedback {form} />

	{#if showInvite}
		<SectionCard title={t('admin.addPlayer')}>
			<div id="invite-form">
				<InvitePlayerForm action="?/invite" />
			</div>
		</SectionCard>
	{/if}

	{#if data.players.length > 0}
		<div class="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
			<label class="sr-only" for="player-search">{t('admin.searchPlayers')}</label>
			<input
				class="input sm:max-w-xs"
				id="player-search"
				type="search"
				placeholder={t('admin.searchPlayers')}
				value={query}
				oninput={(event) => setFilters({ query: event.currentTarget.value })}
			/>
			<FilterChips
				items={PLAYER_FILTERS.map((key) => ({ key, label: t(filterLabels[key]) }))}
				active={filter}
				label={t('admin.filter')}
				onselect={(key) => setFilters({ filter: key as PlayerFilter })}
			/>
			{#if filter !== 'all' || query.trim()}
				<p class="text-meta text-muted sm:ml-auto" aria-live="polite">
					{formatCount(filtered.length, 'common.playerCount.one', 'common.playerCount.many')}
				</p>
			{/if}
		</div>
	{/if}

	{#if data.players.length === 0}
		<EmptyState title={t('admin.noPlayers')}>
			{#snippet action()}
				{#if !showInvite}
					<button class="btn-secondary" type="button" onclick={() => (showInvite = true)}>
						{t('admin.addPlayer')}
					</button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else if filtered.length === 0}
		<EmptyState title={t('admin.noResults')} />
	{:else}
		<SectionCard flush clip={false}>
			<ul role="list" class="ledger-columns">
				{#each filtered as player, index (player.userId)}
					{@const menuUp = index >= filtered.length - 2}
					<li class="section-row relative flex items-center gap-3">
						<span class="relative z-10 w-7 shrink-0 text-right font-mono text-caption text-muted">
							{player.jerseyNumber ?? '-'}
						</span>
						<span class="relative z-10 shrink-0"><Avatar player={player} size={32} /></span>
						<div class="min-w-0 flex-1">
							<a
								class="absolute inset-0 z-0"
								href="/admin/joueurs/{player.userId}"
								aria-label={player.fullName}
							></a>
							<div class="pointer-events-none relative z-10 min-w-0">
								<span class="block break-words font-semibold text-ink">{player.fullName}</span>
							</div>
							<p
								class="pointer-events-none relative z-10 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-meta text-muted"
							>
								<span>{t(positionDefinition(player.position).labelKey)} · {formatAge(player.age)}</span>
								{#if player.role !== 'player'}
									<span class="badge-ice"
										>{t(roleDefinition(player.role)?.labelKey ?? 'admin.role.player')}</span
									>
								{/if}
								{#if player.isSubstitute}
									<span class="badge">{t('profile.substitute')}</span>
								{/if}
								{#if data.favorites.get(player.userId)}
									<span class="badge-ice">{t('subs.favorite')}</span>
								{/if}
								{#if !player.active}
									<span class="badge-alert">{t('admin.inactive')}</span>
								{/if}
							</p>
						</div>
						<svg
							viewBox="0 0 24 24"
							class="pointer-events-none relative z-10 hidden h-4 w-4 shrink-0 text-muted sm:block"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path d="m9 6 6 6-6 6" />
						</svg>
						<details class="group relative z-20 shrink-0">
							<summary
								class="btn-secondary btn-icon cursor-pointer list-none marker:content-none"
								aria-label="{t('admin.moreActions')} · {player.fullName}"
							>
								<svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
									<circle cx="5" cy="12" r="1.6" />
									<circle cx="12" cy="12" r="1.6" />
									<circle cx="19" cy="12" r="1.6" />
								</svg>
							</summary>
							<div
								class="sheet absolute right-0 z-20 w-52 p-1 shadow-lift {menuUp
									? 'bottom-[calc(100%+0.35rem)]'
									: 'top-[calc(100%+0.35rem)]'}"
							>
								<form method="POST" action="?/resend" use:progressiveForm>
									<input type="hidden" name="playerId" value={player.userId} />
									<button
										class="flex min-h-11 w-full items-center rounded-control px-2.5 text-left text-body font-medium hover:bg-ice-soft/60"
										type="submit"
									>
										{t('admin.resetPassword')}
									</button>
								</form>
								<form method="POST" action="?/substitute" use:progressiveForm>
									<input type="hidden" name="playerId" value={player.userId} />
									<input type="hidden" name="value" value={player.isSubstitute ? 'false' : 'true'} />
									<button
										class="flex min-h-11 w-full items-center rounded-control px-2.5 text-left text-body font-medium hover:bg-ice-soft/60"
										type="submit"
									>
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
										<button
											class="flex min-h-11 w-full items-center rounded-control px-2.5 text-left text-body font-medium hover:bg-ice-soft/60"
											type="submit"
										>
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
											class="flex min-h-11 w-full items-center rounded-control px-2.5 text-left text-body font-medium text-muted hover:bg-ice-soft/60 hover:text-ink"
										/>
									</form>
								{:else}
									<form method="POST" action="?/active" use:progressiveForm>
										<input type="hidden" name="playerId" value={player.userId} />
										<input type="hidden" name="value" value="true" />
										<button
											class="flex min-h-11 w-full items-center rounded-control px-2.5 text-left text-body font-medium hover:bg-ice-soft/60"
											type="submit"
										>
											{t('admin.reactivate')}
										</button>
									</form>
								{/if}
							</div>
						</details>
					</li>
				{/each}
			</ul>
		</SectionCard>
	{/if}
</div>
