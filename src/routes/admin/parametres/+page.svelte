<script lang="ts">
	import { MONEY_INPUT } from '#config/money.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeader title={t('admin.settings')} meta={t('admin.settingsHelp')}>
	{#snippet actions()}
		<button class="btn-primary btn-sm" type="submit" form="settings-form">
			{t('common.save')}
		</button>
	{/snippet}
</PageHeader>

<FormFeedback {form} class="mb-4" />

<nav class="mb-5 flex gap-1 overflow-x-auto pb-1" aria-label={t('admin.settingsJump')}>
	{#each data.groups as group (group.key)}
		<a
			class="flex min-h-11 shrink-0 items-center rounded-control border border-line-strong bg-surface px-3 text-[13px] font-medium text-muted no-underline hover:bg-paper hover:text-ink"
			href="#groupe-{group.key}"
		>
			{t(group.labelKey)}
		</a>
	{/each}
</nav>

<form id="settings-form" method="POST" action="?/save" use:progressiveForm class="space-y-6">
	{#each data.groups as group (group.key)}
		<section
			id="groupe-{group.key}"
			class="scroll-mt-[var(--anchor-offset)] border-t border-line pt-4"
		>
			<h2 class="text-xl">{t(group.labelKey)}</h2>
			<div class="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
				{#each group.settings as setting (setting.key)}
					<div class={setting.kind === 'boolean' ? 'sm:col-span-2' : ''}>
						{#if setting.kind === 'boolean'}
							<label class="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
								<input
									type="checkbox"
									name={setting.key}
									checked={Boolean(data.values[setting.key])}
									class="h-4 w-4 accent-[var(--color-ice)]"
								/>
								{t(setting.labelKey)}
							</label>
						{:else}
							<label class="label" for={setting.key}>{t(setting.labelKey)}</label>
							{#if setting.kind === 'select'}
								<select class="input" id={setting.key} name={setting.key}>
									{#each setting.options as option (option.value)}
										<option value={option.value} selected={data.values[setting.key] === option.value}>
											{t(option.labelKey)}
										</option>
									{/each}
								</select>
							{:else if setting.kind === 'money'}
								<div class="relative">
									<input
										class="input pr-8"
										id={setting.key}
										name={setting.key}
										type="number"
										inputmode="decimal"
										min={MONEY_INPUT.min}
										step={MONEY_INPUT.step}
										value={data.values[setting.key]}
									/>
									<span class="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted">$</span>
								</div>
							{:else if setting.kind === 'number'}
								<input
									class="input"
									id={setting.key}
									name={setting.key}
									type="number"
									inputmode="numeric"
									min={setting.min}
									max={setting.max}
									step={setting.step ?? 1}
									value={data.values[setting.key]}
								/>
							{:else if setting.kind === 'date'}
								<input
									class="input"
									id={setting.key}
									name={setting.key}
									type="date"
									value={data.values[setting.key]}
								/>
							{:else if setting.kind === 'time'}
								<input
									class="input"
									id={setting.key}
									name={setting.key}
									type="time"
									value={data.values[setting.key]}
								/>
							{:else}
								<input
									class="input"
									id={setting.key}
									name={setting.key}
									type="text"
									value={data.values[setting.key]}
								/>
							{/if}
						{/if}
						{#if data.descriptions[setting.key]}
							<p class="hint">{data.descriptions[setting.key]}</p>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/each}

	<div class="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
		<p class="text-xs text-muted">{t('admin.settingsSaveHint')}</p>
		<button class="btn-primary w-full sm:w-auto" type="submit">{t('common.save')}</button>
	</div>
</form>
