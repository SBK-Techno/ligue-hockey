<script lang="ts">
	import { mapUrlFor } from '#config/maps.ts';
	import type { LocationMetrics } from '#lib/domain/locations/service.ts';
	import { LOCATION_LIMITS } from '#config/games.ts';
	import { formatCount, formatDate, t } from '#lib/shared/i18n/index.ts';
	import ConfirmSubmit from '#lib/ui/ConfirmSubmit.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import MapLink from '#lib/ui/MapLink.svelte';
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

<PageHeader title={t('admin.locationsTitle')} meta={t('admin.locationsHelp')} />

<div class="page-stack">
	<FormFeedback {form} />

	<div class="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
		<SectionCard title={t('admin.addLocation')}>
			<form method="POST" action="?/create" use:progressiveForm class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
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
				<div class="sm:col-span-2 lg:col-span-1">
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
				<div class="sm:col-span-2 lg:col-span-1">
					<label class="label" for="new-location-notes">{t('admin.locationNotes')}</label>
					<textarea
						class="input"
						id="new-location-notes"
						name="notes"
						rows="2"
						maxlength={LOCATION_LIMITS.notesMax}
					></textarea>
				</div>
				<div class="sm:col-span-2 lg:col-span-1">
					<button class="btn-primary" type="submit">{t('admin.addLocation')}</button>
				</div>
			</form>
		</SectionCard>

		{#if data.locations.length === 0}
			<EmptyState title={t('admin.locationsEmpty')}>
				{#snippet action()}
					<a class="btn-secondary" href="#new-location-name">{t('admin.addLocation')}</a>
				{/snippet}
			</EmptyState>
		{:else}
			<SectionCard flush>
				<p class="section-row text-meta text-muted">
					{formatCount(data.locations.length, 'admin.locationCount.one', 'admin.locationCount.many')}
				</p>
				<ul role="list" class="divide-y divide-line">
					{#each data.locations as location (location.id)}
						{@const metric = metricsById.get(location.id)}
						{@const href = mapHref(location)}
						<li>
							<RecordRow title={location.name} meta={metaFor(location, metric)} />
							<div class="px-4 pb-3">
								<div class="flex flex-wrap items-center gap-3">
									{#if href}
										<MapLink href={href} />
									{/if}
									{#if (metric?.gameCount ?? 0) > 0}
										<p class="hint">{t('admin.locationInUse')}</p>
									{/if}
								</div>

								{#if location.notes}
									<p class="mt-2 whitespace-pre-wrap break-words text-body text-muted">{location.notes}</p>
								{/if}

								<details class="group mt-2 border-t border-line pt-1">
									<summary
										class="link flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-body marker:content-none"
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

									{#if (metric?.gameCount ?? 0) > 0}
										<div class="mt-3">
											<button
												class="btn-ghost btn-sm"
												type="button"
												disabled
												aria-describedby="location-delete-{location.id}"
											>
												{t('common.delete')}
											</button>
											<p class="hint" id="location-delete-{location.id}">
												{t('admin.locationInUse')}
											</p>
										</div>
									{:else}
										<form method="POST" action="?/delete" use:progressiveForm class="mt-3">
											<input type="hidden" name="id" value={location.id} />
											<ConfirmSubmit
												label={t('common.delete')}
												question={t('admin.locationDeleteConfirm')}
												confirmLabel={t('common.delete')}
												class="btn-ghost btn-sm"
											/>
										</form>
									{/if}
								</details>
							</div>
						</li>
					{/each}
				</ul>
			</SectionCard>
		{/if}
	</div>
</div>
