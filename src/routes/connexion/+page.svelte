<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { t } from '#lib/shared/i18n/index.ts';

	let { data, form }: PageProps = $props();
</script>

<div class="card">
	<h2 class="mb-1">{t('auth.title')}</h2>
	<p class="mb-6 text-sm text-muted">{t('auth.subtitle')}</p>

	{#if data.reset}
		<p class="success mb-5">{t('invite.success')}</p>
	{/if}
	{#if form?.message}
		<p class="alert mb-5">{form.message}</p>
	{/if}

	<form method="POST" use:enhance class="space-y-4">
		<input type="hidden" name="next" value={data.next} />
		<div>
			<label class="label" for="email">{t('auth.email')}</label>
			<input
				class="input"
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				required
			/>
		</div>
		<div>
			<label class="label" for="password">{t('auth.password')}</label>
			<input
				class="input"
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</div>
		<button class="btn-primary w-full" type="submit">{t('auth.submit')}</button>
	</form>
</div>
