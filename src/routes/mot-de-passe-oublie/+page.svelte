<script lang="ts">
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<div class="card">
	<h1 class="text-figure">{t('auth.reset.title')}</h1>

	{#if !form?.sent}
		<p class="mt-1 text-body leading-relaxed text-muted">{t('auth.reset.lead')}</p>
	{/if}
	<FormFeedback {form} class="mt-5" />

	{#if !form?.sent}
		<form method="POST" use:progressiveForm class="mt-6 space-y-4">
			<div>
				<label class="label" for="email">{t('auth.email')}</label>
				<input
					class="input"
					id="email"
					name="email"
					type="email"
					inputmode="email"
					autocomplete="email"
					autocapitalize="none"
					spellcheck="false"
					required
				/>
			</div>
			<button class="btn-primary w-full" type="submit">{t('auth.reset.submit')}</button>
		</form>
	{/if}

	<div class="mt-5 text-center">
		<a class="action-link text-body" href="/connexion">{t('auth.reset.back')}</a>
	</div>
</div>
