import { AVATAR_IDS } from '#config/avatars.ts';
import { LEGEND_IDS } from '#config/legends.ts';
import { identityAllowedForPosition, type IdentityId } from '#config/identities.ts';
import type { Position } from '#config/positions.ts';

/**
 * The order the picker presents: tribute legends first, then the league faces
 * kept as a capacity fallback for existing profiles and full leagues.
 */
const ASSIGNMENT_ORDER = [...LEGEND_IDS, ...AVATAR_IDS];

/**
 * Automatic identity assignment. This is a server-side use case, separate from
 * the display lookups so a page that only paints an avatar never loads the
 * catalogue of names, numbers and eras.
 *
 * First free identity in assignment order: tribute legends first, then the
 * league faces. With a position, legends that played another position are
 * skipped, so a forward never receives a goalie. The caller decides what to do
 * with a null result: an exhausted catalogue is never stored as a null
 * identity.
 */
export function firstFreeAvatarId(
	used: Iterable<string>,
	position?: Position
): IdentityId | null {
	const taken = new Set(used);
	return (
		ASSIGNMENT_ORDER.find(
			(avatarId) =>
				!taken.has(avatarId) &&
				(position === undefined || identityAllowedForPosition(avatarId, position))
		) ?? null
	);
}
