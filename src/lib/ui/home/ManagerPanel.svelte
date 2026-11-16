<script lang="ts">
	import { formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import StatStrip from '#lib/ui/StatStrip.svelte';

	let {
		summary,
		gameId,
		gameDate,
		startTime,
		location
	}: {
		summary: {
			openSlots: number;
			present: number;
			absent: number;
			unknown: number;
			generated: boolean;
		};
		gameId: string;
		gameDate: string;
		startTime: string;
		location: string;
	} = $props();
</script>

<SectionCard title={t('home.managerTitle')}>
	<div class="p-4">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p class="text-meta text-muted">
				{formatDate(gameDate, 'short')} · {formatTime(startTime)} · {location}
			</p>
			<span class={summary.generated ? 'badge-ok' : 'badge'}>
				{summary.generated ? t('games.generated') : t('games.notGenerated')}
			</span>
		</div>

		<div class="mt-3">
			<StatStrip
				cells={[
					{ value: summary.openSlots, label: t('home.openPlaces') },
					{ value: summary.present, label: t('home.present') },
					{ value: summary.absent, label: t('home.absent') },
					{ value: summary.unknown, label: t('availability.unknown') }
				]}
			/>
		</div>

		<a class="btn-primary mt-4 w-full" href="/admin/matchs/{gameId}">
			{t('home.manageGame')}
		</a>
	</div>
</SectionCard>
