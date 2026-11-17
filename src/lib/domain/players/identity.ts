import {
	AVATAR_IDS,
	avatarById,
	DEFAULT_AVATAR_ID,
	isAvatarId,
	type AvatarId
} from '#config/avatars.ts';

/**
 * Player visual identity.
 *
 * A stored avatar always wins. A profile without an avatar, or whose id is no
 * longer in the catalogue, receives a stable avatar derived from its account
 * id: the same person keeps the same appearance across sessions without a
 * database write.
 */

/** FNV-1a 32 bits: short, deterministic and dependency-free. */
function stableHash(value: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

export function resolveAvatarId(
	userId: string,
	avatarId?: string | null
): AvatarId {
	if (isAvatarId(avatarId)) return avatarId;
	return AVATAR_IDS[stableHash(userId) % AVATAR_IDS.length] ?? DEFAULT_AVATAR_ID;
}

/** The CSS property name, never a raw colour. */
export function avatarColor(avatarId: AvatarId): string {
	return `--color-player-${avatarById[avatarId].color}`;
}

/** First free avatar in catalogue order. */
export function firstFreeAvatarId(used: Iterable<string>): AvatarId | null {
	const taken = new Set(used);
	return AVATAR_IDS.find((avatarId) => !taken.has(avatarId)) ?? null;
}
