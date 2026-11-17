<script lang="ts">
	import type { Position } from '#config/positions.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import Avatar from './Avatar.svelte';
	import AvatarPicker from './AvatarPicker.svelte';

	let {
		selected,
		taken = [],
		position,
		player,
		legendName,
		actionLabel = t('profile.identityChange'),
		help,
		legendsTitle,
		legendsHelp
	}: {
		selected: string;
		taken?: readonly string[];
		position: Position | null;
		player: { fullName: string; userId: string };
		legendName: string | null;
		/** Le libellé de l'action suit le contexte : le membre change la sienne,
		 *  un responsable change celle du joueur. */
		actionLabel?: string;
		help?: string;
		legendsTitle?: string;
		legendsHelp?: string;
	} = $props();
</script>

<details class="group rounded-control border border-line-strong bg-surface">
	<summary
		class="flex min-h-11 cursor-pointer list-none items-center gap-3 p-2 marker:content-none"
	>
		<Avatar player={{ ...player, avatarId: selected }} size={40} peek={false} />
		<span class="min-w-0 flex-1">
			<span class="block truncate text-body font-semibold">
				{legendName ?? t('profile.avatarLeague')}
			</span>
			<span class="block text-meta text-muted">{actionLabel}</span>
		</span>
		<svg
			viewBox="0 0 24 24"
			class="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	</summary>
	<div class="border-t border-line p-3">
		<AvatarPicker {selected} {taken} {position} {help} {legendsTitle} {legendsHelp} />
	</div>
</details>
