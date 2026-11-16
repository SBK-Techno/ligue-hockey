<script lang="ts">
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { t } from '#lib/shared/i18n/index.ts';
	import PasswordField from '#lib/ui/PasswordField.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div class="card">
	{#if !data.token || data.invalid}
		<h2 class="text-2xl">{t('invite.title')}</h2>
		<p class="alert mt-5" role="alert">{t('invite.expired')}</p>
		<p class="mt-4 text-sm leading-relaxed text-muted">{t('invite.expiredHelp')}</p>
		<a class="btn-primary mt-6 w-full" href="/mot-de-passe-oublie">{t('auth.reset.submit')}</a>
		<a class="link mt-4 block text-center text-sm" href="/connexion">{t('auth.reset.back')}</a>
	{:else}
		<h2 class="text-2xl">{t('invite.title')}</h2>
		<p class="mt-1 text-sm leading-relaxed text-muted">{t('invite.lead')}</p>

		<FormFeedback {form} class="mt-5" />

		<form method="POST" use:progressiveForm class="mt-6 space-y-4">
			<input type="hidden" name="token" value={data.token} />
			<PasswordField
				id="password"
				name="password"
				label={t('invite.password')}
				autocomplete="new-password"
				minlength={data.minLength}
				hint={t('invite.tooShort', { count: data.minLength })}
			/>
			<PasswordField
				id="confirm"
				name="confirm"
				label={t('invite.confirm')}
				autocomplete="new-password"
			/>
			<button class="btn-primary w-full" type="submit">{t('invite.submit')}</button>
		</form>
		<a class="link mt-5 block text-center text-sm" href="/connexion">{t('auth.reset.back')}</a>
	{/if}
</div>
