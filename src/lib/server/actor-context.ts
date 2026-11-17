import { branding } from '#lib/generated/branding.ts';

/**
 * Les fichiers publics ne lisent jamais l'acteur. Toute autre route, page,
 * requête de données et appel d'API le fait, quel que soit son en-tête Accept :
 * un curl ou un client d'API qui demande une page doit résoudre la session.
 *
 * La liste vient entièrement du propriétaire du branding : un nouveau fichier
 * généré ou un service worker n'a pas de second propriétaire ici.
 */
export const PUBLIC_ASSET_PATHS: ReadonlySet<string> = new Set<string>(
	branding.publicPaths
);

export function actorContextRequired(pathname: string): boolean {
	if (pathname.startsWith('/_app/')) return false;
	return !PUBLIC_ASSET_PATHS.has(pathname);
}
