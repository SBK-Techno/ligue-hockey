<script lang="ts">
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		label,
		question,
		title = t('common.confirm'),
		confirmLabel = t('common.confirm'),
		cancelLabel = t('common.cancel'),
		tone = 'danger',
		submitName,
		submitValue,
		class: className = tone === 'danger' ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'
	}: {
		label: string;
		question: string;
		title?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		/** Une confirmation destructive porte le rouge; une action neutre garde l'encre. */
		tone?: 'danger' | 'neutral';
		/** Nom et valeur du bouton soumis par la confirmation, quand le formulaire en a besoin. */
		submitName?: string;
		submitValue?: string;
		class?: string;
	} = $props();

	let trigger: HTMLButtonElement | undefined = $state();

	async function open() {
		const { askConfirm } = await import('./confirm.svelte.ts');
		const confirmed = await askConfirm({
			title,
			question,
			confirmLabel,
			cancelLabel,
			tone
		});
		if (!confirmed) return;
		const form = trigger?.form;
		if (!form) return;
		if (submitName) {
			const submitter = document.createElement('button');
			submitter.type = 'submit';
			submitter.name = submitName;
			submitter.value = submitValue ?? '';
			submitter.hidden = true;
			form.append(submitter);
			form.requestSubmit(submitter);
			submitter.remove();
			return;
		}
		form.requestSubmit();
	}
</script>

<button bind:this={trigger} type="button" class={className} onclick={open}>{label}</button>
