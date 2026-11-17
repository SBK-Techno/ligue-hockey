<script lang="ts">
	import { MONEY_INPUT } from '#config/money.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import StickySaveBar from '#lib/ui/StickySaveBar.svelte';
	import { currencySymbol, formatCount, t } from '#lib/shared/i18n/index.ts';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const symbol = $derived(currencySymbol(data.currency));

	function openGroupFor(control: HTMLElement) {
		const group = control.closest('details');
		if (group instanceof HTMLDetailsElement) group.open = true;
		void tick().then(() => control.focus());
	}

	/** Une valeur invalide dans un groupe fermé ne doit pas bloquer en silence. */
	function revealInvalid(event: Event) {
		openGroupFor(event.target as HTMLElement);
	}

	$effect(() => {
		const setting = (form as { setting?: string } | null)?.setting;
		if (!form || form.ok !== false || !setting) return;
		const control = document.getElementById(setting);
		if (control) openGroupFor(control);
	});
</script>

<PageHeader title={t('admin.settings')} meta={t('admin.settingsHelp')} />

<form
	id="settings-form"
	method="POST"
	action="?/save"
	use:progressiveForm
	class="space-y-4"
	oninvalidcapture={revealInvalid}
>
	{#each data.groups as group (group.key)}
		<details
			id="groupe-{group.key}"
			class="group border-t border-line"
			open
		>
			<summary
				class="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2"
			>
				<h2>{t(group.labelKey)}</h2>
				<span class="flex items-center gap-2">
					<span class="serial"
						>{formatCount(group.settings.length, 'admin.settingCount.one', 'admin.settingCount.many')}</span
					>
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
				</span>
			</summary>
			<div class="grid gap-x-8 pb-3 xl:grid-cols-2">
				{#each group.settings as setting (setting.key)}
					{#if setting.kind === 'boolean'}
						<label class="flex min-h-11 cursor-pointer items-center gap-3 py-1.5 text-body font-medium">
							<input
								type="checkbox"
								name={setting.key}
								checked={Boolean(data.values[setting.key])}
								class="h-4 w-4 accent-[var(--color-ink)]"
							/>
							<span>
								{t(setting.labelKey)}
								{#if data.descriptions[setting.key]}
									<span class="mt-0.5 block text-caption font-normal leading-snug text-muted">
										{data.descriptions[setting.key]}
									</span>
								{/if}
							</span>
						</label>
					{:else}
						<div class="grid grid-cols-[7.25rem_minmax(0,1fr)] gap-2 py-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start sm:gap-3">
							<label class="label mb-0 pt-2.5" for={setting.key}>{t(setting.labelKey)}</label>
							<div class="min-w-0">
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
										<span
											class="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-body text-muted"
											>{symbol}</span
										>
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
								{#if data.descriptions[setting.key]}
									<p class="mt-1 text-caption leading-snug text-muted">
										{data.descriptions[setting.key]}
									</p>
								{/if}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</details>
	{/each}

	<StickySaveBar>
		<FormFeedback {form} />
		<div class="mt-1 flex flex-wrap items-center justify-between gap-2">
			<p class="text-caption text-muted">{t('admin.settingsSaveHint')}</p>
			<button class="btn-primary w-full sm:w-auto" type="submit">{t('common.save')}</button>
		</div>
	</StickySaveBar>
</form>
