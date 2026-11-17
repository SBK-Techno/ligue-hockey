/**
 * La palette de l'application vit dans `src/lib/ui/tokens.css`. Les courriels,
 * les documents et les images générées ne peuvent pas lire des variables CSS,
 * donc le générateur extrait les mêmes valeurs au lieu de les recopier.
 *
 * La palette sémantique est la seule famille déclarée ici : un jeton absent ou
 * en trop fait échouer le test de catalogue.
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

const COLOUR = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;

/** Tous les jetons de couleur du fichier, dans l'ordre où ils sont déclarés. */
export function parseColourTokens(css: string): Map<string, string> {
	const found = new Map<string, string>();
	for (const match of css.matchAll(COLOUR)) {
		found.set(match[1], match[2].toLowerCase());
	}
	return found;
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
