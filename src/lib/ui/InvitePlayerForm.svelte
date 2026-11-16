<script lang="ts">
	import { PLAYER_LIMITS } from '#config/players.ts';
	import { POSITIONS } from '#config/positions.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import { progressiveForm } from '#lib/ui/progressive-form.ts';

	let {
		action,
		substitute = false,
		submitLabel = t('admin.invite'),
		onSuccess
	}: {
		/** Action SvelteKit du formulaire, par exemple `?/invite`. */
		action: string;
		/** Force l'inscription à la banque de remplaçants et masque la case. */
		substitute?: boolean;
		submitLabel?: string;
		onSuccess?: () => void;
	} = $props();

	const uid = $props.id();
	const fieldId = (name: string) => `${uid}-${name}`;
</script>

<form
	method="POST"
	{action}
	use:progressiveForm={{ onSuccess: () => onSuccess?.() }}
	class="grid gap-4 sm:grid-cols-2"
>
	<div>
		<label class="label" for={fieldId('firstName')}>{t('profile.firstName')}</label>
		<input
			class="input"
			id={fieldId('firstName')}
			name="firstName"
			required
			maxlength={PLAYER_LIMITS.nameMax}
			autocomplete="given-name"
		/>
	</div>
	<div>
		<label class="label" for={fieldId('lastName')}>{t('profile.lastName')}</label>
		<input
			class="input"
			id={fieldId('lastName')}
			name="lastName"
			required
			maxlength={PLAYER_LIMITS.nameMax}
			autocomplete="family-name"
		/>
	</div>
	<div class="sm:col-span-2">
		<label class="label" for={fieldId('email')}>{t('profile.email')}</label>
		<input
			class="input"
			id={fieldId('email')}
			name="email"
			type="email"
			inputmode="email"
			autocomplete="email"
			autocapitalize="none"
			spellcheck="false"
			required
			maxlength={PLAYER_LIMITS.emailMax}
		/>
		<p class="hint">{t('admin.emailHint')}</p>
	</div>
	<div>
		<label class="label" for={fieldId('position')}>{t('profile.position')}</label>
		<select class="input" id={fieldId('position')} name="position" required>
			<option value="">{t('admin.choosePosition')}</option>
			{#each POSITIONS as position (position.key)}
				<option value={position.key}>{t(position.labelKey)}</option>
			{/each}
		</select>
	</div>
	<div>
		<label class="label" for={fieldId('age')}>{t('profile.age')}</label>
		<input
			class="input"
			id={fieldId('age')}
			name="age"
			type="number"
			inputmode="numeric"
			min={PLAYER_LIMITS.ageMin}
			max={PLAYER_LIMITS.ageMax}
			placeholder={String(PLAYER_LIMITS.defaultAge)}
			required
		/>
		<p class="hint">{t('admin.ageHint')}</p>
	</div>
	<div>
		<label class="label" for={fieldId('jerseyNumber')}>{t('admin.jerseyNumber')}</label>
		<input
			class="input"
			id={fieldId('jerseyNumber')}
			name="jerseyNumber"
			type="number"
			inputmode="numeric"
			min={PLAYER_LIMITS.jerseyMin}
			max={PLAYER_LIMITS.jerseyMax}
			placeholder={String(PLAYER_LIMITS.jerseyExample)}
		/>
	</div>
	{#if substitute}
		<input type="hidden" name="isSubstitute" value="true" />
	{:else}
		<label class="flex min-h-11 items-center gap-3 text-sm font-medium sm:col-span-2">
			<input type="checkbox" name="isSubstitute" class="h-4 w-4" />
			{t('profile.substitute')}
		</label>
	{/if}
	<div class="sm:col-span-2">
		<button class="btn-primary" type="submit">{submitLabel}</button>
	</div>
</form>
