import type { IdentityId } from '#config/identities.ts';
import { branding } from '#lib/generated/branding.ts';

/**
 * Player visual identity.
 *
 * A stored identity always wins, whether it is a league face or a tribute
 * legend. A profile without one, or whose id left the catalogue, receives a
 * stable league avatar derived from its account id: the same person keeps the
 * same appearance across sessions without a database write.
 *
 * The lookups read the compact index generated from the catalogue, so an
 * avatar surface never imports the names, numbers and eras of 58 identities.
 * The catalogue remains the only source of that index.
 */

export type { IdentityId };

const identityIds = branding.identities.ids as readonly IdentityId[];
const indexById = new Map<string, number>(
	identityIds.map((identityId, index) => [identityId, index])
);
const leagueIds = identityIds.slice(0, branding.identities.leagueFaces);

/** FNV-1a 32 bits: short, deterministic and dependency-free. */
function stableHash(value: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

export function isIdentityId(
	value: string | null | undefined
): value is IdentityId {
	return typeof value === 'string' && indexById.has(value);
}

export function resolveAvatarId(
	userId: string,
	avatarId?: string | null
): IdentityId {
	if (isIdentityId(avatarId)) return avatarId;
	return leagueIds[stableHash(userId) % leagueIds.length] ?? identityIds[0]!;
}
