/**
 * Les actifs nommés par contenu ne sont pas supprimés dès qu'une génération
 * les remplace : un document encore en cache peut les demander. Ils restent
 * donc servis pendant la fenêtre de cache des documents actifs.
 */
export const GENERATED_ASSET_RETENTION_DAYS = 7;

const RETENTION_MS = GENERATED_ASSET_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function retainedForCache(mtimeMs: number, nowMs: number): boolean {
	return nowMs - mtimeMs < RETENTION_MS;
}

/** `static/icons/favicon-32.<12 hex>.png`, la forme de tout actif daté. */
const HASHED_ASSET =
	/^static\/(icons|auth|textures|identities|social)\/([a-z0-9-]+)-([0-9a-f]{12})\.(png|webp|svg|jpe?g)$/;

/**
 * Un actif conservé reste vérifiable : son nom porte le préfixe de son propre
 * contenu. Un fichier déposé à la main ne peut donc pas se faire passer pour
 * un actif généré simplement en imitant la forme du nom.
 */
export function isRetainedHashedAsset(relativePath: string, sha256: string): boolean {
	const match = HASHED_ASSET.exec(relativePath);
	return match !== null && sha256.startsWith(match[3]);
}
