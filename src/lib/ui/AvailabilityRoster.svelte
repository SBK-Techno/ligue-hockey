<script lang="ts">
	import type { AvailabilityView } from '#lib/domain/availability/service.ts';
	import { formatCount, t } from '#lib/shared/i18n/index.ts';
	import StatStrip from '#lib/ui/StatStrip.svelte';

	let { availability, viewerId }: { availability: AvailabilityView; viewerId: string } = $props();

	const present = $derived(
		availability.rows
			.filter((row) => row.status === 'present')
			.map((row) => ({ playerId: row.playerId, fullName: row.fullName }))
	);
	const absent = $derived(
		availability.rows
			.filter((row) => row.status === 'absent')
			.map((row) => ({ playerId: row.playerId, fullName: row.fullName }))
	);
	const pending = $derived(
		availability.pending.map((row) => ({ playerId: row.playerId, fullName: row.fullName }))
	);
</script>

<StatStrip
	cells={[
		{ value: availability.present, label: t('home.present') },
		{ value: availability.absent, label: t('home.absent') },
		{ value: availability.unknown, label: t('home.pending') }
	]}
/>

{#if absent.length > 0 || pending.length > 0}
	<ul role="list" class="mt-3 divide-y divide-line border-y border-line">
		{#each absent as row (row.playerId)}
			<li class="flex min-h-11 items-center gap-2 px-1 py-1.5">
				<span aria-hidden="true" class="h-2 w-2 shrink-0 bg-ink"></span>
				<span class="min-w-0 flex-1 break-words {row.playerId === viewerId ? 'font-semibold' : ''}">
					{row.fullName}
				</span>
				<span class="stamp shrink-0 border-line text-muted">{t('availability.absent')}</span>
			</li>
		{/each}
		{#each pending as row (row.playerId)}
			<li class="flex min-h-11 items-center gap-2 px-1 py-1.5 text-muted">
				<span aria-hidden="true" class="h-2 w-2 shrink-0 border border-line-strong"></span>
				<span class="min-w-0 flex-1 break-words {row.playerId === viewerId ? 'font-semibold text-ink' : ''}">
					{row.fullName}
				</span>
				<span class="stamp shrink-0 border-line text-muted">{t('availability.noAnswer')}</span>
			</li>
		{/each}
	</ul>
{/if}

{#if present.length > 0}
	<details class="group mt-2">
		<summary class="link flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm marker:content-none">
			<svg
				viewBox="0 0 24 24"
				class="h-3.5 w-3.5 transition-transform group-open:rotate-90"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="m9 6 6 6-6 6" />
			</svg>
			{formatCount(present.length, 'home.showPresent.one', 'home.showPresent.many')}
		</summary>
		<ul role="list" class="mt-1 grid gap-x-4 pb-1 text-sm sm:grid-cols-2">
			{#each present as row (row.playerId)}
				<li class="flex min-h-9 items-center gap-2 border-b border-line/70 py-1">
					<span aria-hidden="true" class="h-2 w-2 shrink-0 bg-ice"></span>
					<span class="min-w-0 flex-1 break-words {row.playerId === viewerId ? 'font-semibold' : ''}">
						{row.fullName}
					</span>
					{#if row.playerId === viewerId}
						<span class="stamp shrink-0 border-ice bg-ice-soft text-ice-deep">{t('common.you')}</span>
					{/if}
				</li>
			{/each}
		</ul>
	</details>
{/if}
