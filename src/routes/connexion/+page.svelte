<script lang="ts">
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { t } from '#lib/shared/i18n/index.ts';
	import { resetSuccessKey } from '#lib/ui/reset-mode.ts';
	import PasswordField from '#lib/ui/PasswordField.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div class="card">
	<h1 class="text-2xl">{t('auth.title')}</h1>
	<p class="mt-1 text-sm text-muted">{t('auth.subtitle')}</p>

	{#if data.reset}
		<p class="success mt-5">{t(resetSuccessKey(data.mode))}</p>
	{/if}
	<FormFeedback {form} class="mt-5" />

	<form method="POST" use:progressiveForm class="mt-6 space-y-4">
		<input type="hidden" name="next" value={data.next} />
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
				value={form && 'email' in form ? form.email : ''}
				required
			/>
		</div>
		<PasswordField
			id="password"
			name="password"
			label={t('auth.password')}
			autocomplete="current-password"
		/>
		<div class="flex justify-end">
			<a class="link text-sm" href="/mot-de-passe-oublie">{t('auth.forgot')}</a>
		</div>
		<button class="btn-primary w-full" type="submit">{t('auth.submit')}</button>
	</form>

	<p class="mt-6 border-t border-line/80 pt-4 text-xs leading-relaxed text-muted">
		{t('auth.inviteOnly')}
	</p>
</div>
