<script lang="ts">
	import type { AvailabilityView } from '#lib/domain/availability/service.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	let { availability, viewerId }: { availability: AvailabilityView; viewerId: string } = $props();

	type Column = {
		key: 'present' | 'absent' | 'pending';
		label: string;
		count: number;
		names: Array<{ playerId: string; fullName: string }>;
		dot: string;
	};

	const columns = $derived.by<Column[]>(() => [
		{
			key: 'present',
			label: t('home.present'),
			count: availability.present,
			names: availability.rows
				.filter((row) => row.status === 'present')
				.map((row) => ({ playerId: row.playerId, fullName: row.fullName })),
			dot: 'bg-ice'
		},
		{
			key: 'absent',
			label: t('home.absent'),
			count: availability.absent,
			names: availability.rows
				.filter((row) => row.status === 'absent')
				.map((row) => ({ playerId: row.playerId, fullName: row.fullName })),
			dot: 'bg-ink'
		},
		{
			key: 'pending',
			label: t('home.pending'),
			count: availability.unknown,
			names: availability.pending.map((row) => ({
				playerId: row.playerId,
				fullName: row.fullName
			})),
			dot: 'border border-line-strong bg-transparent'
		}
	]);
</script>

<div class="grid gap-6 sm:grid-cols-3">
	{#each columns as column (column.key)}
		<div>
			<div class="flex items-baseline gap-2">
				<span class="numeric text-2xl text-ink">{column.count}</span>
				<h3 class="text-sm font-semibold text-muted">{column.label}</h3>
			</div>
			<ul role="list" class="mt-2 space-y-1.5 text-sm">
				{#each column.names as row (row.playerId)}
					<li class="flex items-center gap-2">
						<span
							aria-hidden="true"
							class="h-2 w-2 shrink-0 rounded-full {column.dot}"
						></span>
						<span class="min-w-0 {row.playerId === viewerId ? 'font-semibold text-ink' : ''}">
							{row.fullName}
						</span>
						{#if row.playerId === viewerId}
							<span class="badge-ice shrink-0">{t('common.you')}</span>
						{/if}
					</li>
				{:else}
					<li class="text-muted">{t('common.none')}</li>
				{/each}
			</ul>
		</div>
	{/each}
</div>
