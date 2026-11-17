import {
	AVATAR_IDS,
	DEFAULT_AVATAR_ID,
	type AvatarId
} from '#config/avatars.ts';
import {
	IDENTITY_IDS,
	identityAllowedForPosition,
	identityById,
	isIdentityId,
	type IdentityId
} from '#config/identities.ts';
import type { Position } from '#config/positions.ts';

/**
 * Player visual identity.
 *
 * A stored identity always wins, whether it is a league face or a tribute
 * legend. A profile without one, or whose id left the catalogue, receives a
 * stable league avatar derived from its account id: the same person keeps the
 * same appearance across sessions without a database write.
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
): IdentityId {
	if (isIdentityId(avatarId)) return avatarId;
	return AVATAR_IDS[stableHash(userId) % AVATAR_IDS.length] ?? DEFAULT_AVATAR_ID;
}

/** The CSS property name, never a raw colour. */
export function avatarColor(avatarId: IdentityId): string {
	return `--color-player-${identityById[avatarId].color}`;
}

/**
 * First free identity in catalogue order. League faces come before legends, so
 * automatic assignment only reaches a tribute identity once every face is
 * taken. With a position, legends that played another position are skipped, so
 * a forward never receives a goalie. The caller decides what to do with a null
 * result: an exhausted catalogue is never stored as a null identity.
 */
export function firstFreeAvatarId(
	used: Iterable<string>,
	position?: Position
): IdentityId | null {
	const taken = new Set(used);
	return (
		IDENTITY_IDS.find(
			(avatarId) =>
				!taken.has(avatarId) &&
				(position === undefined || identityAllowedForPosition(avatarId, position))
		) ?? null
	);
}

export type { AvatarId, IdentityId };
