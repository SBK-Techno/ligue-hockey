<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import InstallPrompt from '#lib/ui/InstallPrompt.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import RecordRow from '#lib/ui/RecordRow.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import ActionsPanel from '#lib/ui/home/ActionsPanel.svelte';
	import HomeAttendance from '#lib/ui/home/HomeAttendance.svelte';
	import HomeHero from '#lib/ui/home/HomeHero.svelte';
	import LeaguePanel from '#lib/ui/home/LeaguePanel.svelte';
	import ManagerPanel from '#lib/ui/home/ManagerPanel.svelte';
	import MonthCalendar from '#lib/ui/home/MonthCalendar.svelte';
	import PollPanel from '#lib/ui/home/PollPanel.svelte';
	import SubstitutesPanel from '#lib/ui/home/SubstitutesPanel.svelte';
	import TeamPanel from '#lib/ui/home/TeamPanel.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const actor = $derived(data.actor.kind === 'user' ? data.actor : null);
</script>

<FormFeedback {form} class="mb-4" />

{#if data.board}
	<PageHeader
		eyebrow={data.seasonLabel}
		title={t('home.title')}
		meta={t('home.greeting', { name: actor?.name.split(' ')[0] ?? '' })}
	/>

	<div class="page-stack">
		<HomeHero
			variant={data.board.hero}
			game={data.game}
			availability={data.availability}
			ownSlot={data.ownSlot}
			ownBench={data.ownBench}
			ownRequest={data.ownRequest}
			isSubstitute={data.isSubstitute}
			isManager={data.isManager}
			hasGame={data.game !== null}
		/>

		<div class="board-grid">
		{#each data.board.panels as panel, index (panel.kind)}
			<div class="reveal" style="--span: {panel.span}; --i: {index}">
				{#if panel.kind === 'manager'}
					{#if data.managerSummary && data.game}
						<ManagerPanel
							summary={data.managerSummary}
							gameId={data.game.id}
							gameDate={data.game.gameDate}
							startTime={data.game.startTime}
							location={data.game.location}
							showGameMeta={!data.hasPlayerProfile}
							showAttendance={!data.hasPlayerProfile}
						/>
					{/if}
				{:else if panel.kind === 'actions'}
					<ActionsPanel
						actions={data.board.actions}
						balance={data.balance}
						evaluationGame={data.evaluationGame}
						ownRequest={data.ownRequest}
						claimable={data.claimable}
						openPoll={data.openPoll}
					/>
				{:else if panel.kind === 'team'}
					{#if data.game}
						<TeamPanel
							game={data.game}
							ownSlot={data.ownSlot}
							ownBench={data.ownBench}
							actorId={actor?.userId ?? ''}
						/>
					{/if}
				{:else if panel.kind === 'calendar'}
					{#if data.calendar}
						<MonthCalendar calendar={data.calendar} />
					{/if}
				{:else if panel.kind === 'upcoming'}
					<SectionCard
						title={t('home.upcoming')}
						href="/matchs"
						linkLabel={t('home.allGames')}
						flush
					>
						<ul role="list" class="divide-y divide-line">
							{#each data.nextGames as next (next.id)}
								{@const status = gameStatus(next.status)}
								<li>
									<RecordRow
										href="/matchs/{next.id}"
										date={formatDate(next.gameDate, 'short')}
										title="{formatTime(next.startTime)} · {next.location}"
										badge={next.status === 'scheduled' ? undefined : t(status.labelKey)}
										badgeTone={status.tone}
									/>
								</li>
							{/each}
						</ul>
					</SectionCard>
				{:else if panel.kind === 'attendance'}
					{#if data.availability && data.game}
						<SectionCard title={t('home.attendance')}>
							<HomeAttendance availability={data.availability} />
						</SectionCard>
					{/if}
				{:else if panel.kind === 'poll'}
					{#if data.openPoll}
						<PollPanel messageId={data.openPoll.messageId} poll={data.openPoll.poll} />
					{/if}
				{:else if panel.kind === 'substitutes'}
					{#if data.panelClaims.length > 0 || data.panelOwnRequest}
						<SubstitutesPanel
							requests={data.panelClaims}
							ownRequest={data.panelOwnRequest}
						/>
					{/if}
				{:else if panel.kind === 'league'}
					{#if data.latestMessage}
						<LeaguePanel message={data.latestMessage} />
					{/if}
				{:else if panel.kind === 'install'}
					<InstallPrompt />
				{/if}
			</div>
		{/each}
		</div>
	</div>
{/if}
