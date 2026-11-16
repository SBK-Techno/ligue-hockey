<script lang="ts">
	import { RATING_ATTRIBUTES } from '#config/rating-attributes.ts';
	import { positionDefinition } from '#config/positions.ts';
	import {
		formatCount,
		formatDecimal,
		formatTimestamp,
		t
	} from '#lib/shared/i18n/index.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import RatingScale from '#lib/ui/RatingScale.svelte';
	import SectionCard from '#lib/ui/SectionCard.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeader
	title={data.player.fullName}
	meta="{t(positionDefinition(data.player.position).labelKey)} · {t('admin.evaluationsSeason')}"
	back={{ href: '/admin/evaluations', label: t('admin.evaluationBack') }}
/>

<FormFeedback {form} class="mb-4" />

<form method="POST" action="?/save" use:progressiveForm={{ reset: false }} class="space-y-4">
	<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
		<div class="space-y-4">
			<SectionCard title={t('rating.seasonTitle')}>
				<div class="border-b border-line px-4 py-2">
					<p class="text-meta leading-snug text-muted">{t('rating.scaleHelp')}</p>
				</div>
				<div class="divide-y divide-line px-4 py-1">
					{#each RATING_ATTRIBUTES as attribute (attribute.key)}
						<RatingScale
							name={attribute.key}
							label={t(attribute.labelKey)}
							value={data.ratings.values[attribute.key]}
							clearable
						/>
					{/each}
				</div>
			</SectionCard>

			<SectionCard title={t('rating.positionTitle')}>
				<div class="divide-y divide-line px-4 py-1">
					{#each data.attributes as attribute (attribute.key)}
						<RatingScale
							name={attribute.key}
							label={t(attribute.labelKey)}
							help={t(attribute.helpKey)}
							value={data.ratings.positionValues[attribute.key]}
							clearable
						/>
					{/each}
				</div>
			</SectionCard>
		</div>

		<aside class="space-y-3">
			<section class="sheet p-4">
				<p class="serial">{t('rating.overall')}</p>
				<p class="numeric mt-2 text-4xl">
					{data.ratings.overall === null
						? t('rating.notRated')
						: formatDecimal(data.ratings.overall, 2)}
				</p>
				<p class="mt-2 text-meta text-muted">{t('rating.overallHelp')}</p>
			</section>

			<section class="sheet p-4">
				<div class="flex items-start justify-between gap-2">
					<p class="serial">{t('rating.positionOverall')}</p>
					{#if !data.ratings.positionComplete && data.ratings.positionOverall !== null}
						<span class="badge">{t('rating.partial')}</span>
					{/if}
				</div>
				<p class="numeric mt-2 text-2xl">
					{data.ratings.positionOverall === null
						? t('rating.notAvailable')
						: formatDecimal(data.ratings.positionOverall, 2)}
				</p>
				<p class="mt-2 text-meta text-muted">{t('rating.positionDescriptive')}</p>
				<p class="mt-1 text-meta text-muted">
					{t('rating.positionCriteria', {
						done: Object.keys(data.ratings.positionValues).length,
						total: data.ratings.positionTotal
					})}
				</p>
			</section>

			<section class="sheet p-4">
				<dl class="divide-y divide-line">
					<div class="fact">
						<dt>{t('rating.form')}</dt>
						<dd>
							{data.ratings.form.average === null
								? t('rating.notAvailable')
								: formatDecimal(data.ratings.form.average, 2)}
						</dd>
					</div>
					<div class="fact">
						<dt>{t('rating.gamesCount')}</dt>
						<dd>{data.ratings.form.games}</dd>
					</div>
					{#if data.ratings.updatedAt}
						<div class="fact">
							<dt>{t('rating.lastUpdated')}</dt>
							<dd>{formatTimestamp(data.ratings.updatedAt)}</dd>
						</div>
					{/if}
				</dl>
				{#if data.ratings.form.games > 0}
					<p class="mt-2 text-meta text-muted">
						{formatCount(
							data.ratings.form.games,
							'rating.formHelp.one',
							'rating.formHelp.many'
						)}
					</p>
				{/if}
			</section>
		</aside>
	</div>

	<div class="sticky bottom-0 z-10 -mx-4 border-t border-line bg-paper/95 px-4 sticky-action-bar backdrop-blur">
		<button class="btn-primary w-full sm:w-auto" type="submit">{t('common.save')}</button>
	</div>
</form>
