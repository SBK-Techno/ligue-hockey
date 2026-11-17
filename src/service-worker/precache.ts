import type { branding as BrandingValue } from '#lib/generated/branding.ts';

type Branding = typeof BrandingValue;

/**
 * La liste exacte installée par le service worker. Elle ne dépend ni des
 * actifs publics complets ni de l'ordre du manifeste : seuls la coquille
 * immuable, la page hors ligne, le manifeste et les icônes du manifeste.
 */
export function precachePaths(immutable: readonly string[], branding: Branding): string[] {
	return [
		...new Set([
			...immutable,
			branding.offlinePath,
			branding.manifestPath,
			branding.icons.favicon,
			branding.icons.icon192
		])
	];
}
