/**
 * Player avatar catalogue.
 *
 * Each variant is a complete, stable identity: skin tone, hair colour,
 * background, hairstyle, facial hair and glasses. The vector renderer lives in
 * `src/lib/ui/avatar-art.ts` and reads only this catalogue.
 */

export type AvatarStyle =
  | 'short'
  | 'buzz'
  | 'curly'
  | 'long'
  | 'bun'
  | 'bald'
  | 'toque'
  | 'helmet'
  | 'mask';

export type AvatarFacialHair = 'none' | 'stubble' | 'moustache' | 'beard';
export type AvatarMouth = 'smile' | 'flat' | 'grin';

/**
 * Les nuances valides sont aussi la liste des jetons de `tokens.css`. Une
 * teinte ajoutée ici doit exister comme jeton; le test de catalogue le refuse
 * sinon.
 */
export const AVATAR_SKIN_TONES = [1, 2, 3, 4, 5, 6] as const;
export const AVATAR_HAIR_SHADES = [1, 2, 3, 4, 5, 6] as const;
export const AVATAR_BACKGROUND_SHADES = [1, 2, 3, 4, 5, 6] as const;

export type AvatarSkin = (typeof AVATAR_SKIN_TONES)[number];
export type AvatarHair = (typeof AVATAR_HAIR_SHADES)[number];
export type AvatarBackground = (typeof AVATAR_BACKGROUND_SHADES)[number];

/**
 * The drawing contract shared by every identity family. The base league
 * avatars and the tribute legends both satisfy it, so the renderer has one
 * input shape and no knowledge of where an identity comes from.
 */
export type AvatarArt = {
  id: string;
  color: number;
  skin: AvatarSkin;
  hair: AvatarHair;
  bg: AvatarBackground;
  style: AvatarStyle;
  facial: AvatarFacialHair;
  glasses: boolean;
  mouth: AvatarMouth;
};

export const AVATARS = [
  { id: 'capitaine-navy', color: 1, skin: 3, hair: 1, bg: 2, style: 'short', facial: 'none', glasses: false, mouth: 'smile' },
  { id: 'barbe-de-brique', color: 2, skin: 5, hair: 6, bg: 1, style: 'buzz', facial: 'beard', glasses: false, mouth: 'flat' },
  { id: 'boucles-printanieres', color: 3, skin: 1, hair: 3, bg: 4, style: 'curly', facial: 'none', glasses: true, mouth: 'smile' },
  { id: 'criniere-doree', color: 4, skin: 4, hair: 4, bg: 5, style: 'long', facial: 'none', glasses: false, mouth: 'grin' },
  { id: 'chignon-de-suede', color: 5, skin: 2, hair: 2, bg: 3, style: 'bun', facial: 'moustache', glasses: false, mouth: 'flat' },
  { id: 'tete-rassee', color: 6, skin: 6, hair: 5, bg: 6, style: 'bald', facial: 'stubble', glasses: false, mouth: 'smile' },
  { id: 'tuque-rouge', color: 7, skin: 2, hair: 1, bg: 1, style: 'toque', facial: 'none', glasses: false, mouth: 'smile' },
  { id: 'masque-debutant', color: 8, skin: 1, hair: 4, bg: 2, style: 'mask', facial: 'none', glasses: false, mouth: 'grin' },
  { id: 'casque-denim', color: 9, skin: 4, hair: 3, bg: 3, style: 'helmet', facial: 'none', glasses: false, mouth: 'flat' },
  { id: 'lunettes-de-bureau', color: 10, skin: 1, hair: 2, bg: 4, style: 'short', facial: 'none', glasses: true, mouth: 'flat' },
  { id: 'barbe-grise', color: 11, skin: 3, hair: 5, bg: 5, style: 'short', facial: 'beard', glasses: false, mouth: 'smile' },
  { id: 'couettes-longues', color: 12, skin: 5, hair: 6, bg: 6, style: 'long', facial: 'none', glasses: false, mouth: 'smile' },
  { id: 'moustache-de-bronze', color: 13, skin: 2, hair: 4, bg: 2, style: 'buzz', facial: 'moustache', glasses: false, mouth: 'grin' },
  { id: 'masque-rouge', color: 14, skin: 3, hair: 2, bg: 4, style: 'mask', facial: 'none', glasses: false, mouth: 'flat' },
  { id: 'frisettes-courtes', color: 15, skin: 6, hair: 1, bg: 1, style: 'curly', facial: 'none', glasses: false, mouth: 'smile' },
  { id: 'chignon-dore', color: 16, skin: 1, hair: 4, bg: 3, style: 'bun', facial: 'none', glasses: true, mouth: 'smile' },
  { id: 'lunettes-sport', color: 17, skin: 4, hair: 1, bg: 5, style: 'short', facial: 'stubble', glasses: true, mouth: 'flat' },
  { id: 'barbe-rousse', color: 18, skin: 5, hair: 3, bg: 6, style: 'buzz', facial: 'beard', glasses: false, mouth: 'smile' },
  { id: 'casque-noir', color: 19, skin: 2, hair: 5, bg: 1, style: 'helmet', facial: 'none', glasses: false, mouth: 'grin' },
  { id: 'tete-nue', color: 20, skin: 3, hair: 2, bg: 4, style: 'bald', facial: 'none', glasses: true, mouth: 'smile' },
  { id: 'longue-ondulation', color: 21, skin: 1, hair: 5, bg: 2, style: 'long', facial: 'none', glasses: false, mouth: 'flat' },
  { id: 'tuque-de-neige', color: 22, skin: 6, hair: 4, bg: 3, style: 'toque', facial: 'stubble', glasses: false, mouth: 'grin' },
  { id: 'masque-veteran', color: 23, skin: 4, hair: 5, bg: 5, style: 'mask', facial: 'none', glasses: false, mouth: 'smile' },
  { id: 'barbe-brune', color: 24, skin: 3, hair: 2, bg: 6, style: 'short', facial: 'beard', glasses: true, mouth: 'flat' },
  { id: 'boucles-sombres', color: 25, skin: 5, hair: 6, bg: 1, style: 'curly', facial: 'moustache', glasses: false, mouth: 'smile' },
  { id: 'casque-ardent', color: 26, skin: 1, hair: 3, bg: 4, style: 'helmet', facial: 'none', glasses: true, mouth: 'flat' },
  { id: 'masque-final', color: 27, skin: 6, hair: 3, bg: 5, style: 'mask', facial: 'none', glasses: false, mouth: 'grin' },
  { id: 'chignon-de-nuit', color: 28, skin: 4, hair: 6, bg: 2, style: 'bun', facial: 'none', glasses: false, mouth: 'smile' }
] as const satisfies readonly AvatarArt[];

export type AvatarVariant = (typeof AVATARS)[number];
export type AvatarId = AvatarVariant['id'];

export const AVATAR_IDS = AVATARS.map((avatar) => avatar.id) as [AvatarId, ...AvatarId[]];

export const DEFAULT_AVATAR_ID: AvatarId = AVATARS[0].id;
