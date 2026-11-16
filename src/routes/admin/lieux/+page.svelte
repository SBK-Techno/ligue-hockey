<script lang="ts">
	import { mapUrlFor } from '#config/maps.ts';
	import type { LocationMetrics } from '#lib/domain/locations/service.ts';
	import { LOCATION_LIMITS } from '#lib/domain/locations/validators.ts';
	import { formatCount, formatDate, t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import RecordRow from '#lib/ui/RecordRow.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const metricsById = $derived(
		new Map(data.metrics.map((metric) => [metric.locationId, metric]))
	);

	function summary(metric: LocationMetrics | undefined): string {
		if (!metric || metric.gameCount === 0) return t('admin.locationNoGames');

		const parts = [
			formatCount(
				metric.gameCount,
				'admin.locationGames.one',
				'admin.locationGames.many'
			)
		];
		if (metric.nextGameDate) {
			parts.push(
				t('admin.locationNext', { date: formatDate(metric.nextGameDate, 'short') })
			);
		}
		if (metric.lastGameDate) {
			parts.push(
				t('admin.locationLast', { date: formatDate(metric.lastGameDate, 'short') })
			);
		}
		if (metric.completedCount > 0) {
			parts.push(
				formatCount(
					metric.completedCount,
					'admin.locationCompleted.one',
					'admin.locationCompleted.many'
				)
			);
		}
		return parts.join(' · ');
	}

	function metaFor(location: { address: string | null }, metric: LocationMetrics | undefined) {
		return [location.address ?? t('admin.locationNoAddress'), summary(metric)].join(' · ');
	}

	function mapHref(location: { address: string | null; mapUrl: string | null }) {
		return mapUrlFor(location.address, location.mapUrl);
	}
</script>

<FormFeedback {form} class="mb-4" />

<PageHeader title={t('admin.locationsTitle')} meta={t('admin.locationsHelp')} />

<SectionCard title={t('admin.addLocation')}>
	<form method="POST" action="?/create" use:progressiveForm class="grid gap-3 p-4 sm:grid-cols-2">
		<div>
			<label class="label" for="new-location-name">{t('admin.locationName')}</label>
			<input
				class="input"
				id="new-location-name"
				name="name"
				maxlength={LOCATION_LIMITS.nameMax}
				required
			/>
		</div>
		<div>
			<label class="label" for="new-location-address">{t('admin.locationAddress')}</label>
			<input
				class="input"
				id="new-location-address"
				name="address"
				maxlength={LOCATION_LIMITS.addressMax}
			/>
		</div>
		<div class="sm:col-span-2">
			<label class="label" for="new-location-map">{t('admin.locationMap')}</label>
			<input
				class="input"
				id="new-location-map"
				name="mapUrl"
				type="url"
				maxlength={LOCATION_LIMITS.mapUrlMax}
				placeholder="https://"
			/>
			<p class="hint">{t('admin.locationMapHelp')}</p>
		</div>
		<div class="sm:col-span-2">
			<label class="label" for="new-location-notes">{t('admin.locationNotes')}</label>
			<textarea
				class="input"
				id="new-location-notes"
				name="notes"
				rows="2"
				maxlength={LOCATION_LIMITS.notesMax}
			></textarea>
		</div>
		<div class="sm:col-span-2">
			<button class="btn-primary" type="submit">{t('admin.addLocation')}</button>
		</div>
	</form>
</SectionCard>

<div class="mt-4">
	<SectionCard title="{t('admin.locations')} ({data.locations.length})">
		{#if data.locations.length === 0}
			<div class="px-4 py-3">
				<p class="text-sm text-muted">{t('admin.locationsEmpty')}</p>
			</div>
		{:else}
			<ul role="list" class="divide-y divide-line/70">
				{#each data.locations as location (location.id)}
					{@const metric = metricsById.get(location.id)}
					{@const href = mapHref(location)}
					<li>
						<RecordRow title={location.name} meta={metaFor(location, metric)} />
						<div class="px-4 pb-3">
							<div class="flex flex-wrap items-center gap-3">
								{#if href}
									<a class="link text-sm" href={href} target="_blank" rel="noreferrer">
										{t('games.openMap')}
									</a>
								{/if}
								{#if (metric?.gameCount ?? 0) > 0}
									<p class="hint">{t('admin.locationInUse')}</p>
								{/if}
							</div>

							{#if location.notes}
								<p class="mt-2 whitespace-pre-wrap text-sm text-muted">{location.notes}</p>
							{/if}

							<details class="group mt-2 border-t border-line/70 pt-1">
								<summary
									class="link flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm marker:content-none"
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
									{t('admin.locationEdit')}
								</summary>

								<form
									method="POST"
									action="?/update"
									use:progressiveForm
									class="mt-3 grid gap-3 sm:grid-cols-2"
								>
									<input type="hidden" name="id" value={location.id} />
									<div>
										<label class="label" for="location-name-{location.id}">
											{t('admin.locationName')}
										</label>
										<input
											class="input"
											id="location-name-{location.id}"
											name="name"
											value={location.name}
											maxlength={LOCATION_LIMITS.nameMax}
											required
										/>
									</div>
									<div>
										<label class="label" for="location-address-{location.id}">
											{t('admin.locationAddress')}
										</label>
										<input
											class="input"
											id="location-address-{location.id}"
											name="address"
											value={location.address ?? ''}
											maxlength={LOCATION_LIMITS.addressMax}
										/>
									</div>
									<div class="sm:col-span-2">
										<label class="label" for="location-map-{location.id}">
											{t('admin.locationMap')}
										</label>
										<input
											class="input"
											id="location-map-{location.id}"
											name="mapUrl"
											type="url"
											value={location.mapUrl ?? ''}
											maxlength={LOCATION_LIMITS.mapUrlMax}
											placeholder="https://"
										/>
									</div>
									<div class="sm:col-span-2">
										<label class="label" for="location-notes-{location.id}">
											{t('admin.locationNotes')}
										</label>
										<textarea
											class="input"
											id="location-notes-{location.id}"
											name="notes"
											rows="2"
											maxlength={LOCATION_LIMITS.notesMax}>{location.notes ?? ''}</textarea
										>
									</div>
									<div class="sm:col-span-2">
										<button class="btn-primary btn-sm" type="submit">
											{t('common.save')}
										</button>
									</div>
								</form>

								<form method="POST" action="?/delete" use:progressiveForm class="mt-3">
									<input type="hidden" name="id" value={location.id} />
									<ConfirmSubmit
										label={t('common.delete')}
										question={t('admin.locationDeleteConfirm')}
										confirmLabel={t('common.delete')}
										class="btn-ghost btn-sm"
									/>
								</form>
							</details>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</SectionCard>
</div>
