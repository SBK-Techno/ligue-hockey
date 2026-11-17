<script lang="ts">
	import type { HomePanel } from '#lib/domain/home/composition.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import HomeHero from '#lib/ui/home/HomeHero.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const actor = $derived(data.actor.kind === 'user' ? data.actor : null);
	const mainPanels = $derived(data.board?.panels.filter((panel) => panel.zone === 'main') ?? []);
	const railPanels = $derived(data.board?.panels.filter((panel) => panel.zone === 'rail') ?? []);
	// L'invite d'installation est facultative et ne rend rien sur le serveur :
	// seule, elle ne justifie pas une colonne de situation vide à droite.
	const hasRail = $derived(railPanels.some((panel) => panel.kind !== 'install'));

	// Les îlots sont importés au niveau du module : le serveur les rend, le
	// navigateur ne demande que ceux dont la page a réellement besoin, après
	// la peinture initiale. Aucun panneau ne figure donc dans le graphe de
	// départ, mais aucun contenu n'est perdu au rendu serveur.
	// svelte-ignore state_referenced_locally
	const initial = data;
	const panels = new Set(initial.board?.panels.map((panel) => panel.kind) ?? []);
	const hasManager =
		panels.has('manager') && initial.managerSummary !== null && initial.game !== null;
	const hasTeam = panels.has('team') && initial.game !== null;
	const hasAttendance =
		panels.has('attendance') && initial.availability !== null && initial.game !== null;
	const hasPoll = panels.has('poll') && initial.openPoll !== null;
	const hasSubstitutes =
		panels.has('substitutes') &&
		(initial.panelClaims.length > 0 || initial.panelOwnRequest !== null);
	const hasLeague = panels.has('league') && initial.latestMessage !== null;

	const [
		ManagerPanel,
		ActionsPanel,
		TeamPanel,
		SeasonAgenda,
		UpcomingPanel,
		HomeAttendance,
		PollPanel,
		SubstitutesPanel,
		LeaguePanel,
		InstallPrompt
	] = await Promise.all([
		hasManager
			? import('#lib/ui/home/ManagerPanel.svelte').then((module) => module.default)
			: null,
		panels.has('actions')
			? import('#lib/ui/home/ActionsPanel.svelte').then((module) => module.default)
			: null,
		hasTeam ? import('#lib/ui/home/TeamPanel.svelte').then((module) => module.default) : null,
		panels.has('agenda')
			? import('#lib/ui/home/SeasonAgenda.svelte').then((module) => module.default)
			: null,
		panels.has('upcoming')
			? import('#lib/ui/home/UpcomingPanel.svelte').then((module) => module.default)
			: null,
		hasAttendance
			? import('#lib/ui/home/HomeAttendance.svelte').then((module) => module.default)
			: null,
		hasPoll ? import('#lib/ui/home/PollPanel.svelte').then((module) => module.default) : null,
		hasSubstitutes
			? import('#lib/ui/home/SubstitutesPanel.svelte').then((module) => module.default)
			: null,
		hasLeague
			? import('#lib/ui/home/LeaguePanel.svelte').then((module) => module.default)
			: null,
		panels.has('install')
			? import('#lib/ui/InstallPrompt.svelte').then((module) => module.default)
			: null
	]);
</script>


<FormFeedback {form} class="mb-4" />

{#if data.board}
{#snippet homePanel(panel: HomePanel)}
	{#if panel.kind === 'manager'}
		{#if hasManager && ManagerPanel && data.managerSummary && data.game}
			<ManagerPanel
				summary={data.managerSummary}
				gameId={data.game.id}
				gameDate={data.game.gameDate}
				startTime={data.game.startTime}
				location={data.game.location}
				showGameMeta={!data.hasPlayerProfile}
			/>
		{/if}
	{:else if panel.kind === 'actions'}
		{#if ActionsPanel}
			<ActionsPanel
				actions={data.board.actions}
				balance={data.balance}
				evaluationGame={data.evaluationGame}
				ownRequest={data.ownRequest}
				claimable={data.claimable}
				openPoll={data.openPoll}
			/>
		{/if}
	{:else if panel.kind === 'team'}
		{#if hasTeam && TeamPanel && data.game}
			<TeamPanel
				game={data.game}
				ownSlot={data.ownSlot}
				ownBench={data.ownBench}
				actorId={actor?.userId ?? ''}
			/>
		{/if}
	{:else if panel.kind === 'agenda'}
		{#if SeasonAgenda}
			<SeasonAgenda upcoming={data.agenda.upcoming} past={data.agenda.past} />
		{/if}
	{:else if panel.kind === 'upcoming'}
		{#if UpcomingPanel}
			<UpcomingPanel games={data.nextGames} />
		{/if}
	{:else if panel.kind === 'attendance'}
		{#if hasAttendance && HomeAttendance && data.availability && data.game}
			<SectionCard title={t('home.attendance')}>
				<HomeAttendance availability={data.availability} />
			</SectionCard>
		{/if}
	{:else if panel.kind === 'poll'}
		{#if hasPoll && PollPanel && data.openPoll}
			<PollPanel messageId={data.openPoll.messageId} poll={data.openPoll.poll} />
		{/if}
	{:else if panel.kind === 'substitutes'}
		{#if hasSubstitutes && SubstitutesPanel}
			<SubstitutesPanel requests={data.panelClaims} ownRequest={data.panelOwnRequest} />
		{/if}
	{:else if panel.kind === 'league'}
		{#if hasLeague && LeaguePanel && data.latestMessage}
			<LeaguePanel message={data.latestMessage} />
		{/if}
	{:else if panel.kind === 'install'}
		{#if InstallPrompt}
			<InstallPrompt />
		{/if}
	{/if}
{/snippet}

	<PageHeader
		eyebrow={data.seasonLabel}
		title={t('home.title')}
		meta={t('home.greeting', { name: actor?.name.split(' ')[0] ?? '' })}
	/>

	<div class="page-stack">
		<div class="home-dashboard" data-rail={hasRail}>
			<div class="home-main">
				<div class="home-panel reveal" data-panel="hero" style="--span: 12; --i: 0">
					<HomeHero
						variant={data.board.hero}
						game={data.game}
						mapUrl={data.gameMapUrl}
						teamLabel={data.ownTeamLabel}
						availability={data.availability}
						ownSlot={data.ownSlot}
						ownBench={data.ownBench}
						ownRequest={data.ownRequest}
						isSubstitute={data.isSubstitute}
						isManager={data.isManager}
						hasGame={data.game !== null}
					/>
				</div>

				{#each mainPanels as panel, index (panel.kind)}
					<div
						class="home-panel reveal"
						data-panel={panel.kind}
						style="--span: {panel.span}; --i: {index + 1}"
					>
						{@render homePanel(panel)}
					</div>
				{/each}
			</div>

			{#if railPanels.length > 0}
				<div class="home-rail">
					{#each railPanels as panel, index (panel.kind)}
						<div
							class="home-panel reveal"
							data-panel={panel.kind}
							style="--span: {panel.span}; --i: {index + mainPanels.length + 1}"
						>
							{@render homePanel(panel)}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
