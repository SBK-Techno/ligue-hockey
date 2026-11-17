<script lang="ts">
	import { isIdentityId } from '#config/identities.ts';
	import { avatarColor, resolveAvatarId } from '#lib/domain/players/identity.ts';
	import { t } from '#lib/shared/i18n/index.ts';
	import IdentityPortrait from './IdentityPortrait.svelte';
	import { monogram } from './identity-display.ts';

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
	const boxStyle = $derived(
		`--player-color: var(${avatarColor(avatarId)}); width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.34)}px;`
	);
	const initials = $derived(monogram(player.fullName));

</script>

<!-- The span is a button only when peek is enabled and the avatar is exposed;
     the catalogue stays an image otherwise. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span
	class="avatar-frame inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-paper-deep align-middle"
	style={boxStyle}
	role={decorative ? undefined : peek ? 'button' : 'img'}
	aria-hidden={decorative ? 'true' : undefined}
	aria-label={decorative
		? undefined
		: peek
			? t('profile.avatarOpen', { name: player.fullName })
			: t('profile.avatarOf', { name: player.fullName })}
	data-player-id={peek && !decorative ? player.userId : undefined}
	data-player-peek={peek && !decorative ? 'click' : undefined}
	tabindex={peek && !decorative ? 0 : undefined}
	aria-haspopup={peek && !decorative ? 'dialog' : undefined}
	aria-expanded={peek && !decorative ? 'false' : undefined}
>
	{#if isIdentityId(avatarId)}
		<!-- La planche fixe est chargée une fois; chaque avatar n'est qu'une
		     position dans cette image. -->
		<IdentityPortrait {avatarId} />
	{:else}
		<span class="font-semibold tracking-wide text-ink">{initials}</span>
	{/if}
</span>
