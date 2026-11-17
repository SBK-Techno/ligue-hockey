<script lang="ts">
	import { feedbackFor, type FormResult } from '#lib/ui/form-feedback.ts';

	let {
		form,
		section,
		class: className = ''
	}: {
		form: FormResult;
		/** La section qui possède ce formulaire; sans elle, le message est global. */
		section?: string;
		class?: string;
	} = $props();

	const shown = $derived(feedbackFor(form, section));
	const success = $derived(shown?.ok === true);
</script>

{#if shown?.message}
	<p
		class="{success ? 'success' : 'alert'} {className}"
		role={success ? 'status' : 'alert'}
	>
		{shown.message}
	</p>
{/if}
