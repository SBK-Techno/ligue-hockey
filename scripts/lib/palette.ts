import {
	AVATAR_BACKGROUND_SHADES,
	AVATAR_HAIR_SHADES,
	AVATAR_SKIN_TONES
} from '#config/avatars.ts';

/**
 * La palette de l'application vit dans `src/lib/ui/tokens.css`. Les courriels,
 * les documents et les images générées ne peuvent pas lire des variables CSS,
 * donc le générateur extrait les mêmes valeurs au lieu de les recopier.
 *
 * Les trois familles sont déclarées ici : la palette sémantique, les couleurs
 * de joueur (une par identité du catalogue) et les nuances de dessin des
 * avatars. Un jeton absent ou en trop fait échouer le test de catalogue.
 */
export const PALETTE_KEYS = [
	'ink',
	'paper',
	'paper-deep',
	'surface',
	'on-brand',
	'line',
	'line-strong',
	'muted',
	'ice',
	'ice-deep',
	'ice-soft',
	'accent',
	'accent-deep',
	'accent-soft',
	'alert',
	'alert-deep',
	'alert-soft',
	'ok',
	'ok-soft',
	'team-black',
	'team-white'
] as const;

export type PaletteKey = (typeof PALETTE_KEYS)[number];
export type Palette = Record<PaletteKey, string>;

export type EmailPalette = {
	ink: string;
	paper: string;
	surface: string;
	line: string;
	muted: string;
	brand: string;
};

export type ColourFamilies = {
	palette: readonly string[];
	player: readonly string[];
	avatar: readonly string[];
};

const COLOUR = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;

/** Tous les jetons de couleur du fichier, dans l'ordre où ils sont déclarés. */
export function parseColourTokens(css: string): Map<string, string> {
	const found = new Map<string, string>();
	for (const match of css.matchAll(COLOUR)) {
		found.set(match[1], match[2].toLowerCase());
	}
	return found;
}

/**
 * Le catalogue attendu pour un catalogue d'identités donné. La famille
 * `player` a exactement une couleur par identité : elle ne peut donc pas
 * prendre du retard sur `config/avatars.ts` et `config/legends.ts`.
 */
export function colourFamilies(identityCount: number): ColourFamilies {
	return {
		palette: [...PALETTE_KEYS],
		player: Array.from({ length: identityCount }, (_, index) => `player-${index + 1}`),
		avatar: [
			...AVATAR_SKIN_TONES.map((tone) => `avatar-skin-${tone}`),
			...AVATAR_HAIR_SHADES.map((tone) => `avatar-hair-${tone}`),
			...AVATAR_BACKGROUND_SHADES.map((tone) => `avatar-bg-${tone}`)
		]
	};
}

export function allColourKeys(identityCount: number): string[] {
	const families = colourFamilies(identityCount);
	return [...families.palette, ...families.player, ...families.avatar];
}

export function parsePalette(css: string): Palette {
	const found = parseColourTokens(css);
	const missing = PALETTE_KEYS.filter((key) => !found.has(key));
	if (missing.length > 0) {
		throw new Error(`Palette incomplète dans tokens.css: ${missing.join(', ')}`);
	}

	return Object.fromEntries(
		PALETTE_KEYS.map((key) => [key, found.get(key)])
	) as Palette;
}

export function emailPaletteFrom(palette: Palette): EmailPalette {
	return {
		ink: palette.ink,
		paper: palette.paper,
		surface: palette.surface,
		line: palette.line,
		muted: palette.muted,
		brand: palette.accent
	};
}
