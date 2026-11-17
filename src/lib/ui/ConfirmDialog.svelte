<script lang="ts">
	import type { ConfirmRequest } from './confirm.svelte.ts';

	let {
		request,
		onSettle
	}: {
		request: ConfirmRequest | null;
		onSettle: (confirmed: boolean) => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	const titleId = $props.id();
	const bodyId = `${titleId}-body`;

	$effect(() => {
		if (request && dialog && !dialog.open) dialog.showModal();
		if (!request && dialog?.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby={titleId}
	aria-describedby={bodyId}
	onclose={() => {
		if (request) onSettle(false);
	}}
	class="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40"
>
	{#if request}
		<div class="p-5">
			<h2 id={titleId} class="text-subhead">{request.title}</h2>
			<p id={bodyId} class="mt-2 text-body leading-relaxed text-muted">
				{request.question}
			</p>
			<div class="mt-5 flex flex-wrap justify-end gap-2">
				<button class="btn-secondary" type="button" onclick={() => onSettle(false)}>
					{request.cancelLabel}
				</button>
				<button
					class={request.tone === 'danger' ? 'btn-danger' : 'btn-primary'}
					type="button"
					onclick={() => onSettle(true)}>{request.confirmLabel}</button
				>
			</div>
		</div>
	{/if}
</dialog>
