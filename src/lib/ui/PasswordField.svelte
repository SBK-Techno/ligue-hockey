<script lang="ts">
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		id,
		name,
		label,
		autocomplete = 'current-password',
		minlength,
		hint,
		required = true,
		value = ''
	}: {
		id: string;
		name: string;
		label: string;
		autocomplete?: 'current-password' | 'new-password';
		minlength?: number;
		hint?: string;
		required?: boolean;
		value?: string;
	} = $props();

	let visible = $state(false);
</script>

<div>
	<label class="label" for={id}>{label}</label>
	<div class="relative">
		<input
			class="input pr-12"
			{id}
			{name}
			type={visible ? 'text' : 'password'}
			{autocomplete}
			{minlength}
			{required}
			{value}
		/>
		<button
			type="button"
			class="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-ink/5 hover:text-ink"
			onclick={() => (visible = !visible)}
			aria-label={visible ? t('common.hidePassword') : t('common.showPassword')}
			aria-pressed={visible}
		>
			{#if visible}
				<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
					<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
					<path d="M6.5 6.9C4.5 8.3 3 10.3 2 12c1.7 3.1 5.4 6 10 6 1.7 0 3.3-.4 4.7-1.2M14.4 5.3A10.7 10.7 0 0 1 22 12c-.7 1.3-1.7 2.6-2.9 3.6" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
					<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
					<circle cx="12" cy="12" r="2.6" />
				</svg>
			{/if}
		</button>
	</div>
	{#if hint}
		<p class="hint">{hint}</p>
	{/if}
</div>
