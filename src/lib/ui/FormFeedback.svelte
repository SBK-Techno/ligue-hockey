<script lang="ts">
	let {
		form,
		class: className = ''
	}: {
		form: { ok?: boolean; message?: string } | null;
		class?: string;
	} = $props();

	const success = $derived(form?.ok === true);
</script>

{#if form?.message}
	<p
		class="{success ? 'success' : 'alert'} {className}"
		role={success ? 'status' : 'alert'}
	>
		{form.message}
	</p>
{/if}
