<script lang="ts">
	import type { AvatarArt } from '#config/avatars.ts';
	import { identityById, isIdentityId } from '#config/identities.ts';
	import { avatarColor, resolveAvatarId } from '#lib/domain/players/identity.ts';
	import { branding } from '#lib/generated/branding.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import { identitySymbolId, monogram } from './identity-display.ts';

	type AvatarSize = 24 | 32 | 40 | 48 | 64 | 96;

	let {
		player,
		size = 48,
		decorative = true,
		peek = true
	}: {
		player: { fullName: string; userId: string; avatarId?: string | null };
		size?: AvatarSize;
		decorative?: boolean;
		peek?: boolean;
	} = $props();

	const avatarId = $derived(resolveAvatarId(player.userId, player.avatarId));
	const variant = $derived(variantFor(avatarId));
	const boxStyle = $derived(
		`--player-color: var(${avatarColor(avatarId)}); width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.34)}px;`
	);
	const initials = $derived(monogram(player.fullName));

	function variantFor(id: string): AvatarArt | undefined {
		return isIdentityId(id) ? identityById[id] : undefined;
	}

</script>

<!-- The span is a button only when peek is enabled and the avatar is exposed;
     the catalogue stays an image otherwise. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span
	class="inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-paper-deep align-middle"
	style={boxStyle}
	role={decorative ? undefined : peek ? 'button' : 'img'}
	aria-hidden={decorative ? 'true' : undefined}
	aria-label={decorative
		? undefined
		: peek
			? t('profile.avatarOpen', { name: player.fullName })
			: t('profile.avatarOf', { name: player.fullName })}
	data-player-id={peek ? player.userId : undefined}
	tabindex={peek && !decorative ? 0 : undefined}
	aria-haspopup={peek ? 'dialog' : undefined}
>
	{#if variant}
		<!-- Le catalogue fixe est chargé une fois; chaque avatar n'est qu'une référence. -->
		<svg viewBox="0 0 512 512" class="h-full w-full" aria-hidden="true" focusable="false">
			<use href={`${branding.identitySprite}#${identitySymbolId(avatarId)}`}></use>
		</svg>
	{:else}
		<span class="font-semibold tracking-wide text-ink">{initials}</span>
	{/if}
</span>
