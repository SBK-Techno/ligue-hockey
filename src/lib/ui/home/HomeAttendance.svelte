<script lang="ts">
	import type { AvailabilityView } from '#lib/domain/availability/service.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import StatStrip from '#lib/ui/StatStrip.svelte';

	let { availability }: { availability: AvailabilityView } = $props();

	const present = $derived(
		availability.rows
			.filter((row) => row.status === 'present')
			.map((row) => row.fullName)
	);
	const absent = $derived(
		availability.rows
			.filter((row) => row.status === 'absent')
			.map((row) => row.fullName)
	);
	const pending = $derived(availability.pending.map((row) => row.fullName));
	const hasNames = $derived(present.length > 0 || absent.length > 0 || pending.length > 0);
</script>

<StatStrip
	cells={[
		{ value: availability.present, label: t('home.present') },
		{ value: availability.absent, label: t('home.absent') },
		{ value: availability.unknown, label: t('availability.unknown') }
	]}
/>

{#if hasNames}
	<details class="group mt-2">
		<summary
			class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold marker:content-none"
		>
			<span>{t('home.attendanceNames')}</span>
			<svg
				viewBox="0 0 24 24"
				class="h-4 w-4 text-muted transition-transform group-open:rotate-180"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="m6 9 6 6 6-6" />
			</svg>
		</summary>
		<dl class="mt-1 space-y-2 border-t border-line pt-2 text-xs leading-relaxed">
			{#if present.length > 0}
				<div>
					<dt class="serial">{t('availability.present')}</dt>
					<dd class="mt-0.5 break-words text-muted">{present.join(', ')}</dd>
				</div>
			{/if}
			{#if absent.length > 0}
				<div>
					<dt class="serial">{t('availability.absent')}</dt>
					<dd class="mt-0.5 break-words text-muted">{absent.join(', ')}</dd>
				</div>
			{/if}
			{#if pending.length > 0}
				<div>
					<dt class="serial">{t('availability.unknown')}</dt>
					<dd class="mt-0.5 break-words text-muted">{pending.join(', ')}</dd>
				</div>
			{/if}
		</dl>
	</details>
{/if}
