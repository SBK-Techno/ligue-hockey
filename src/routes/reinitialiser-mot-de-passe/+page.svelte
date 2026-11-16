<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { t } from '#lib/shared/i18n/index.ts';

	let { data, form }: PageProps = $props();
</script>

<div class="card">
	<h2 class="mb-1">{t('invite.title')}</h2>
	<p class="mb-6 text-sm text-muted">{t('invite.subtitle')}</p>

	{#if !data.token || data.invalid}
		<p class="alert">{t('invite.expired')}</p>
		<a class="btn-secondary mt-5 w-full" href="/connexion">{t('auth.submit')}</a>
	{:else}
		{#if form?.message}
			<p class="alert mb-5">{form.message}</p>
		{/if}
		<form method="POST" use:enhance class="space-y-4">
			<input type="hidden" name="token" value={data.token} />
			<div>
				<label class="label" for="password">{t('invite.password')}</label>
				<input
					class="input"
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					minlength={data.minLength}
					required
				/>
				<p class="hint">{t('invite.tooShort', { count: data.minLength })}</p>
			</div>
			<div>
				<label class="label" for="confirm">{t('invite.confirm')}</label>
				<input
					class="input"
					id="confirm"
					name="confirm"
					type="password"
					autocomplete="new-password"
					required
				/>
			</div>
			<button class="btn-primary w-full" type="submit">{t('invite.submit')}</button>
		</form>
	{/if}
</div>
