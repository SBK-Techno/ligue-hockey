<script lang="ts">
	let { icon, class: className = 'h-5 w-5' }: { icon: string; class?: string } = $props();

	const PATHS: Record<string, string> = {
		home: 'M4 11 12 4l8 7v9h-6v-6H10v6H4v-9Z',
		puck: 'M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Zm2 0h12',
		sub: 'M4 7h16M4 12h16M4 17h10',
		chat: 'M4 5h16v11H9l-5 4V5Z',
		user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
		bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20h4',
		clipboard: 'M9 4h6v3H9V4Zm-3 1H4v15h16V5h-2M8 12h8M8 16h5'
	};
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
	<path d={PATHS[icon] ?? PATHS.home} />
</svg>
