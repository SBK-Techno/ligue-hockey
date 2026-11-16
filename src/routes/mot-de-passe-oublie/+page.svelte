<script lang="ts">
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { t } from '#lib/shared/i18n/index.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<div class="card">
	<h1 class="text-2xl">{t('auth.reset.title')}</h1>

	{#if form?.sent}
		<p class="success mt-5" role="status">{form.message}</p>
		<a class="btn-secondary mt-5 w-full" href="/connexion">{t('auth.reset.back')}</a>
	{:else}
		<p class="mt-1 text-sm leading-relaxed text-muted">{t('auth.reset.lead')}</p>
		<FormFeedback {form} class="mt-5" />
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
		<a class="link mt-5 block text-center text-sm" href="/connexion">{t('auth.reset.back')}</a>
	{/if}
</div>
