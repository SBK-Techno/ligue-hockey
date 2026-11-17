import type { branding as BrandingValue } from '#lib/generated/branding.ts';

type Branding = typeof BrandingValue;

/**
 * La coquille installée tient dans un petit budget : les entrées du routeur,
 * la page hors ligne, le manifeste et deux icônes. Les morceaux de route
 * entrent dans le cache d'exécution seulement quand une page les demande.
 */
export const PRECACHE_LIMITS = {
	entries: 8,
	bytes: 512 * 1024
} as const;

/** Le cache d'exécution des morceaux et médias reste borné. */
export const RUNTIME_CACHE_ENTRIES = 120;

const SHELL_PREFIX = '/_app/immutable/entry/';

export function precachePaths(immutable: readonly string[], branding: Branding): string[] {
	const paths = [
		...new Set([
			...immutable.filter((path) => path.startsWith(SHELL_PREFIX)),
			branding.offlinePath,
			branding.manifestPath,
			branding.icons.favicon,
			branding.icons.icon192
		])
	];
	if (paths.length > PRECACHE_LIMITS.entries) {
		throw new Error(
			`Précache trop long: ${paths.length} entrées pour un budget de ${PRECACHE_LIMITS.entries}.`
		);
	}
	return paths;
}
