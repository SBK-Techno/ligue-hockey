<script lang="ts">
	let {
		form,
		class: className = ''
	}: {
		form: { ok?: boolean; message?: string } | null;
		class?: string;
	} = $props();
</script>

{#if form?.message}
	<p
		class="{form.ok === false ? 'alert' : 'success'} {className}"
		role={form.ok === false ? 'alert' : 'status'}
	>
		{form.message}
	</p>
{/if}
