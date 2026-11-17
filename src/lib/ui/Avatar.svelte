<script lang="ts">
	import { avatarById, isAvatarId, type AvatarVariant } from '#config/avatars.ts';
	import { avatarColor, resolveAvatarId } from '#lib/domain/players/identity.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import { avatarSvg } from './avatar-art.ts';

	type AvatarSize = 24 | 32 | 40 | 48 | 64 | 96;

	let {
		player,
		size = 48,
		decorative = true
	}: {
		player: { fullName: string; userId: string; avatarId?: string | null };
		size?: AvatarSize;
		decorative?: boolean;
	} = $props();

	const avatarId = $derived(resolveAvatarId(player.userId, player.avatarId));
	const variant = $derived(variantFor(avatarId));
	const boxStyle = $derived(
		`--player-color: var(${avatarColor(avatarId)}); width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.34)}px;`
	);
	const initials = $derived(monogram(player.fullName));

	function variantFor(id: string): AvatarVariant | undefined {
		return isAvatarId(id) ? avatarById[id] : undefined;
	}

	function monogram(name: string): string {
		return name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('');
	}
</script>

<span
	class="inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-paper-deep align-middle"
	style={boxStyle}
	role={decorative ? undefined : 'img'}
	aria-hidden={decorative ? 'true' : undefined}
	aria-label={decorative ? undefined : t('profile.avatarOf', { name: player.fullName })}
>
	{#if variant}
		<!-- Fixed catalogue only: no player-controlled string reaches the SVG. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html avatarSvg(variant)}
	{:else}
		<span class="font-semibold tracking-wide text-ink">{initials}</span>
	{/if}
</span>
