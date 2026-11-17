import { AVATARS, type AvatarId, type AvatarVariant } from './avatars.ts';
import { LEGENDS, type Legend, type LegendId } from './legends.ts';

/**
 * The one player identity catalogue.
 *
 * Two families share it: the 28 league avatars and the tribute legends. Every
 * consumer that needs to render, validate, colour or reserve an identity reads
 * this module, so adding a family never leaves a second lookup behind.
 *
 * The order matters: base avatars come first, which keeps automatic assignment
 * for a new profile on the league faces until they are all taken.
 */
export type Identity = AvatarVariant | Legend;
export type IdentityId = AvatarId | LegendId;

export const IDENTITIES = [...AVATARS, ...LEGENDS] as const;

export const IDENTITY_IDS = IDENTITIES.map((identity) => identity.id) as [
  IdentityId,
  ...IdentityId[]
];

export const identityById = Object.fromEntries(
  IDENTITIES.map((identity) => [identity.id, identity])
) as Readonly<Record<IdentityId, Identity>>;

export function isIdentityId(
  value: string | null | undefined
): value is IdentityId {
  return typeof value === 'string' && Object.hasOwn(identityById, value);
}

/** The legend facts behind an identity, or null for a league avatar. */
export function legendForIdentity(
  identityId: string | null | undefined
): Legend | null {
  if (!identityId) return null;
  return LEGENDS.find((legend) => legend.id === identityId) ?? null;
}
