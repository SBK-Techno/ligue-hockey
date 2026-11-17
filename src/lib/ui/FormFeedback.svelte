<script lang="ts">
	import { feedbackFor, type FormResult } from '#lib/ui/form-feedback.ts';

	let {
		form,
		section,
		class: className = '',
		focusOnChange = false
	}: {
		form: FormResult;
		/** La section qui possède ce formulaire; sans elle, le message est global. */
		section?: string;
		class?: string;
		/** Déplace le focus sur le message quand un nouveau résultat arrive. */
		focusOnChange?: boolean;
	} = $props();

	const shown = $derived(feedbackFor(form, section));
	const success = $derived(shown?.ok === true);

	let node = $state<HTMLParagraphElement | null>(null);
	let lastShown: FormResult = null;

	// Le résultat arrive après la mise à jour du DOM; le message devient la
	// cible du focus au lieu de laisser le corps de page le recevoir.
	$effect(() => {
		if (!focusOnChange || !shown || !node || shown === lastShown) return;
		lastShown = shown;
		node.focus();
	});
</script>

{#if shown?.message}
	<!-- Le message est une cible de focus programmée, jamais un contrôle. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<p
		bind:this={node}
		tabindex={focusOnChange ? -1 : undefined}
		class="{success ? 'success' : 'alert'} {className}"
		role={success ? 'status' : 'alert'}
	>
		{shown.message}
	</p>
{/if}
