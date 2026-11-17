<script lang="ts">
	import { NAV_ICON_PATHS } from './nav-icons.ts';

	let { icon, class: className = 'h-5 w-5' }: { icon: string; class?: string } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	class={className}
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="square"
	aria-hidden="true"
>
	<path d={NAV_ICON_PATHS[icon] ?? NAV_ICON_PATHS.home} />
</svg>
