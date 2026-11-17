import { IDENTITY_IDS, identityAllowedForPosition, type IdentityId } from '#config/identities.ts';
import type { Position } from '#config/positions.ts';

/**
 * Automatic identity assignment. This is a server-side use case, separate from
 * the display lookups so a page that only paints an avatar never loads the
 * catalogue of names, numbers and eras.
 *
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
