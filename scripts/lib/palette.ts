/**
 * La palette de l'application vit dans `src/lib/ui/tokens.css`. Les courriels,
 * les documents et les images générées ne peuvent pas lire des variables CSS,
 * donc le générateur extrait les mêmes valeurs au lieu de les recopier.
 */
export const PALETTE_KEYS = [
	'ink',
	'paper',
	'surface',
	'line',
	'line-strong',
	'muted',
	'ice',
	'ice-deep',
	'ice-soft',
	'alert',
	'alert-deep',
	'alert-soft',
	'ok',
	'ok-soft',
	'ochre'
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

const COLOUR = /--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;

export function parsePalette(css: string): Palette {
	const found = new Map<string, string>();
	for (const match of css.matchAll(COLOUR)) {
		found.set(match[1], match[2].toLowerCase());
	}

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
		brand: palette.ice
	};
}
