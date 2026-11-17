/**
 * Player avatar catalogue.
 *
 * Each variant is a stable league face. The painted source for each identity
 * lives under `config/branding/portraits/`, and the single sheet is composed by
 * `scripts/lib/branding.ts`; the UI never draws a face itself.
 */

export const AVATARS = [
  { id: 'capitaine-navy' },
  { id: 'barbe-de-brique' },
  { id: 'boucles-printanieres' },
  { id: 'criniere-doree' },
  { id: 'chignon-de-suede' },
  { id: 'tete-rassee' },
  { id: 'tuque-rouge' },
  { id: 'masque-debutant' },
  { id: 'casque-denim' },
  { id: 'lunettes-de-bureau' },
  { id: 'barbe-grise' },
  { id: 'couettes-longues' },
  { id: 'moustache-de-bronze' },
  { id: 'masque-rouge' },
  { id: 'frisettes-courtes' },
  { id: 'chignon-dore' },
  { id: 'lunettes-sport' },
  { id: 'barbe-rousse' },
  { id: 'casque-noir' },
  { id: 'tete-nue' },
  { id: 'longue-ondulation' },
  { id: 'tuque-de-neige' },
  { id: 'masque-veteran' },
  { id: 'barbe-brune' },
  { id: 'boucles-sombres' },
  { id: 'casque-ardent' },
  { id: 'masque-final' },
  { id: 'chignon-de-nuit' }
] as const;

export type AvatarVariant = (typeof AVATARS)[number];
export type AvatarId = AvatarVariant['id'];

export const AVATAR_IDS = AVATARS.map((avatar) => avatar.id) as [AvatarId, ...AvatarId[]];

export const DEFAULT_AVATAR_ID: AvatarId = AVATARS[0].id;
