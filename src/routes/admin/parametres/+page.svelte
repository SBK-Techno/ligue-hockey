<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

{#if form?.message}
	<p class="success mb-4">{form.message}</p>
{/if}

<form method="POST" action="?/save" use:enhance class="space-y-5">
	{#each data.groups as group (group.key)}
		<section class="card">
			<h2 class="mb-4">{t(group.labelKey)}</h2>
			<div class="grid gap-5 sm:grid-cols-2">
				{#each group.settings as setting (setting.key)}
					<div class={setting.kind === 'boolean' ? 'sm:col-span-2' : ''}>
						{#if setting.kind === 'boolean'}
							<label class="flex items-center gap-3 text-sm font-semibold">
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
								<input
									class="input"
									id={setting.key}
									name={setting.key}
									type="number"
									min="0"
									step="0.01"
									value={data.values[setting.key]}
								/>
							{:else if setting.kind === 'number'}
								<input
									class="input"
									id={setting.key}
									name={setting.key}
									type="number"
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

	<button class="btn-primary w-full sm:w-auto" type="submit">{t('common.save')}</button>
</form>
