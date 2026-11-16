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

	let dialog: HTMLDialogElement | undefined = $state();
	let trigger: HTMLButtonElement | undefined = $state();
	const titleId = $props.id();
	const bodyId = `${titleId}-body`;

	function open() {
		dialog?.showModal();
	}

	function confirm() {
		dialog?.close();
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

<dialog
	bind:this={dialog}
	aria-labelledby={titleId}
	aria-describedby={bodyId}
	class="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40"
>
	<div class="p-5">
		<h2 id={titleId} class="text-lg">{title}</h2>
		<p id={bodyId} class="mt-2 text-sm leading-relaxed text-muted">{question}</p>
		<div class="mt-5 flex flex-wrap justify-end gap-2">
			<button class="btn-secondary" type="button" onclick={() => dialog?.close()}>
				{cancelLabel}
			</button>
			<button
				class={tone === 'danger' ? 'btn-danger' : 'btn-primary'}
				type="button"
				onclick={confirm}>{confirmLabel}</button>
		</div>
	</div>
</dialog>
