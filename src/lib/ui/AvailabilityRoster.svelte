<script lang="ts">
	import type { AvailabilityView } from '#lib/domain/availability/service.ts';
	import { formatCount, t } from '#lib/shared/i18n/index.ts';

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

<div class="grid grid-cols-3 divide-x divide-line/70 border-y border-line/70 text-center">
	<div class="px-2 py-3">
		<p class="numeric text-2xl">{availability.present}</p>
		<p class="mt-0.5 text-[11px] text-muted">{t('home.present')}</p>
	</div>
	<div class="px-2 py-3">
		<p class="numeric text-2xl">{availability.absent}</p>
		<p class="mt-0.5 text-[11px] text-muted">{t('home.absent')}</p>
	</div>
	<div class="px-2 py-3">
		<p class="numeric text-2xl">{availability.unknown}</p>
		<p class="mt-0.5 text-[11px] text-muted">{t('home.pending')}</p>
	</div>
</div>

{#if absent.length > 0 || pending.length > 0}
	<ul role="list" class="mt-3 space-y-1.5 text-sm">
		{#each absent as row (row.playerId)}
			<li class="flex items-center gap-2">
				<span aria-hidden="true" class="h-2 w-2 shrink-0 rounded-full bg-ink"></span>
				<span class="min-w-0 break-words {row.playerId === viewerId ? 'font-semibold' : ''}">
					{row.fullName}
				</span>
				{#if row.playerId === viewerId}
					<span class="badge-ice shrink-0">{t('common.you')}</span>
				{/if}
			</li>
		{/each}
		{#each pending as row (row.playerId)}
			<li class="flex items-center gap-2 text-muted">
				<span
					aria-hidden="true"
					class="h-2 w-2 shrink-0 rounded-full border border-line-strong bg-transparent"
				></span>
				<span class="min-w-0 break-words {row.playerId === viewerId ? 'font-semibold text-ink' : ''}">
					{row.fullName}
				</span>
			</li>
		{/each}
	</ul>
{/if}

{#if present.length > 0}
	<details class="group mt-2">
		<summary
			class="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-ice marker:content-none"
		>
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
		<ul role="list" class="mt-1 grid gap-1 pb-1 text-sm sm:grid-cols-2">
			{#each present as row (row.playerId)}
				<li class="flex items-center gap-2">
					<span aria-hidden="true" class="h-2 w-2 shrink-0 rounded-full bg-ice"></span>
					<span class="min-w-0 break-words {row.playerId === viewerId ? 'font-semibold' : ''}">
						{row.fullName}
					</span>
					{#if row.playerId === viewerId}
						<span class="badge-ice shrink-0">{t('common.you')}</span>
					{/if}
				</li>
			{/each}
		</ul>
	</details>
{/if}
