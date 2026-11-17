<script lang="ts">
	import { t } from '#lib/shared/i18n/index.ts';

	let {
		href,
		class: className = ''
	}: {
		href: string;
		class?: string;
	} = $props();
</script>

<a
	class="link inline-flex min-h-11 items-center gap-1 text-body {className}"
	{href}
	target="_blank"
	rel="noreferrer"
>
	{t('games.openMap')}
	<svg
		viewBox="0 0 24 24"
		class="h-3.5 w-3.5"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path d="M14 5h5v5M19 5l-8 8M18 13v6H5V6h6" />
	</svg>
</a>
