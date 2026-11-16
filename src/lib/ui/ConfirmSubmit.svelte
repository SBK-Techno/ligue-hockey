<script lang="ts">
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		label,
		question,
		confirmLabel = t('common.confirm'),
		class: className = 'btn-danger btn-sm'
	}: {
		label: string;
		question: string;
		confirmLabel?: string;
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
		trigger?.form?.requestSubmit();
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
		<h2 id={titleId} class="text-lg">{t('common.confirm')}</h2>
		<p id={bodyId} class="mt-2 text-sm leading-relaxed text-muted">{question}</p>
		<div class="mt-5 flex flex-wrap justify-end gap-2">
			<button class="btn-secondary" type="button" onclick={() => dialog?.close()}>
				{t('common.cancel')}
			</button>
			<button class="btn-danger" type="button" onclick={confirm}>{confirmLabel}</button>
		</div>
	</div>
</dialog>
