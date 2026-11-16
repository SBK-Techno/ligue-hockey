<script lang="ts">
	import { progressiveForm } from '#lib/ui/progressive-form.ts';
	import FormFeedback from '#lib/ui/FormFeedback.svelte';
	import { t } from '#lib/shared/i18n/index.ts';
	import PasswordField from '#lib/ui/PasswordField.svelte';
	import { fieldErrorFor } from '#lib/ui/form-feedback.ts';
	import { resetLeadKey, resetTitleKey } from '#lib/ui/reset-mode.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const expired = $derived(!data.token || data.invalid || form?.expired === true);
</script>

<div class="card">
	{#if expired}
		<h1 class="text-2xl">{t(resetTitleKey(data.mode))}</h1>
		<p class="alert mt-5" role="alert">{t('invite.expired')}</p>
		<p class="mt-4 text-sm leading-relaxed text-muted">{t('invite.expiredHelp')}</p>
		<a class="btn-primary mt-6 w-full" href="/mot-de-passe-oublie">{t('auth.reset.submit')}</a>
		<a class="link mt-4 block text-center text-sm" href="/connexion">{t('auth.reset.back')}</a>
	{:else}
		<h1 class="text-2xl">{t(resetTitleKey(data.mode))}</h1>
		<p class="mt-1 text-sm leading-relaxed text-muted">{t(resetLeadKey(data.mode))}</p>

		<FormFeedback {form} section="mot-de-passe" class="mt-5" />

		<form method="POST" use:progressiveForm class="mt-6 space-y-4">
			<input type="hidden" name="token" value={data.token} />
			<input type="hidden" name="mode" value={data.mode} />
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
				error={fieldErrorFor(form, 'mot-de-passe', 'confirm')}
			/>
			<button class="btn-primary w-full" type="submit">{t('invite.submit')}</button>
		</form>
		<div class="mt-5 text-center">
			<a class="action-link text-sm" href="/connexion">{t('auth.reset.back')}</a>
		</div>
	{/if}
</div>
