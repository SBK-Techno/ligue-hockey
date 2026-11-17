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
	import StatStrip from '#lib/ui/StatStrip.svelte';
	import StickySaveBar from '#lib/ui/StickySaveBar.svelte';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeader
	title={data.player.fullName}
	meta="{t(positionDefinition(data.player.position).labelKey)} · {t('admin.evaluationsSeason')}"
	back={{ href: '/admin/evaluations', label: t('admin.evaluationBack') }}
/>

<form method="POST" action="?/save" use:progressiveForm={{ reset: false }} class="space-y-4">
	<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
		<div class="space-y-4">
			<SectionCard title={t('rating.seasonTitle')}>
				<p class="text-meta leading-snug text-muted">{t('rating.scaleHelp')}</p>
				<div class="mt-2 divide-y divide-line">
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
				<div class="divide-y divide-line">
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
			<StatStrip
				cells={[
					{
						value:
							data.ratings.overall === null
								? '-'
								: formatDecimal(data.ratings.overall, 2),
						label: t('rating.overall')
					},
					{
						value:
							data.ratings.positionOverall === null
								? '-'
								: formatDecimal(data.ratings.positionOverall, 2),
						label: t('rating.positionOverall')
					},
					{
						value:
							data.ratings.form.average === null
								? '-'
								: formatDecimal(data.ratings.form.average, 2),
						label: t('rating.form')
					}
				]}
			/>

			<div class="space-y-2 px-1">
				<p class="text-meta leading-relaxed text-muted">{t('rating.overallHelp')}</p>
				<div class="flex flex-wrap items-center gap-2">
					<p class="text-meta text-muted">
						{t('rating.positionCriteria', {
							done: Object.keys(data.ratings.positionValues).length,
							total: data.ratings.positionTotal
						})}
					</p>
					{#if !data.ratings.positionComplete && data.ratings.positionOverall !== null}
						<span class="badge">{t('rating.partial')}</span>
					{/if}
				</div>
				<p class="text-meta leading-relaxed text-muted">{t('rating.positionDescriptive')}</p>
				<p class="text-meta text-muted">
					{t('rating.gamesCount')} : {data.ratings.form.games}
				</p>
				{#if data.ratings.form.games > 0}
					<p class="text-meta text-muted">
						{formatCount(
							data.ratings.form.games,
							'rating.formHelp.one',
							'rating.formHelp.many'
						)}
					</p>
				{/if}
				{#if data.ratings.updatedAt}
					<p class="text-meta text-muted">
						{t('rating.lastUpdated')} · {formatTimestamp(data.ratings.updatedAt)}
					</p>
				{/if}
			</div>
		</aside>
	</div>

	<StickySaveBar>
		<FormFeedback {form} />
		<button class="btn-primary w-full sm:w-auto" type="submit">{t('common.save')}</button>
	</StickySaveBar>
</form>
