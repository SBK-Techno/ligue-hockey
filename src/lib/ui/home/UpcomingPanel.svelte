<script lang="ts">
	import { gameStatus } from '#config/game-status.ts';
	import type { GameSummary } from '#lib/domain/games/types.ts';
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import RecordRow from '#lib/ui/RecordRow.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';

	let { games }: { games: readonly GameSummary[] } = $props();
</script>

<SectionCard title={t('home.upcoming')} href="/matchs" linkLabel={t('home.allGames')} flush>
	<ul role="list" class="divide-y divide-line">
		{#each games as next (next.id)}
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
