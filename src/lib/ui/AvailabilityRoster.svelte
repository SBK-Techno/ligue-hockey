<script lang="ts">
	import type { AvailabilityView } from '#lib/domain/availability/service.ts';
	import { t } from '#lib/shared/i18n/index.ts';

	let { availability, viewerId }: { availability: AvailabilityView; viewerId: string } = $props();
</script>

<div class="grid gap-5 sm:grid-cols-3">
	<div>
		<h3 class="text-sm font-semibold text-ok">{t('home.present')} · {availability.present}</h3>
		<ul role="list" class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
			{#each availability.rows.filter((row) => row.status === 'present') as row (row.playerId)}
				<li class="flex items-center gap-2" class:font-semibold={row.playerId === viewerId}>
					<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-ok"></span>
					<span class="min-w-0">{row.fullName}</span>
					{#if row.playerId === viewerId}
						<span class="badge-ice ml-auto text-[10px]">{t('common.you')}</span>
					{/if}
				</li>
			{:else}
				<li class="text-muted">{t('common.none')}</li>
			{/each}
		</ul>
	</div>
	<div>
		<h3 class="text-sm font-semibold text-alert">{t('home.absent')} · {availability.absent}</h3>
		<ul role="list" class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
			{#each availability.rows.filter((row) => row.status === 'absent') as row (row.playerId)}
				<li class="flex items-center gap-2" class:font-semibold={row.playerId === viewerId}>
					<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-alert"></span>
					<span class="min-w-0">{row.fullName}</span>
					{#if row.playerId === viewerId}
						<span class="badge-ice ml-auto text-[10px]">{t('common.you')}</span>
					{/if}
				</li>
			{:else}
				<li class="text-muted">{t('common.none')}</li>
			{/each}
		</ul>
	</div>
	<div>
		<h3 class="text-sm font-semibold text-muted">
			{t('home.pending')}{#if availability.unknown > 0} · {availability.unknown}{/if}
		</h3>
		{#if availability.pending.length === 0}
			<p class="mt-2 text-sm text-muted">{t('home.everyoneAnswered')}</p>
		{:else}
			<ul role="list" class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
				{#each availability.pending as row (row.playerId)}
					<li class="flex items-center gap-2" class:font-semibold={row.playerId === viewerId}>
						<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-line"></span>
						<span class="min-w-0">{row.fullName}</span>
						{#if row.playerId === viewerId}
							<span class="badge-ice ml-auto text-[10px]">{t('common.you')}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
