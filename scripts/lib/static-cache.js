/**
 * La politique de cache des fichiers statiques générés. Le manifeste
 * `static/generated-assets.json` est le propriétaire des noms; ce module ne
 * fait que classer les préfixes produits par le générateur.
 */
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
export const SHORT_CACHE = 'public, max-age=300';
export const NO_CACHE = 'no-cache';

const IMMUTABLE_PREFIXES = ['/icons/', '/auth/', '/textures/', '/identities/'];
const SHORT_PATHS = new Set([
	'/generated-assets.json',
	'/manifest.webmanifest',
	'/offline.html',
	'/robots.txt'
]);

/** Les chemins publics que le générateur a nommés par contenu. */
export function generatedAssetPaths(manifest) {
	return new Set(
		Object.keys(manifest?.files ?? {})
			.filter((file) => file.startsWith('static/'))
			.map((file) => `/${file.slice('static/'.length)}`)
			.filter((pathname) => IMMUTABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
	);
}

export function cachePolicyFor(pathname, immutablePaths) {
	if (immutablePaths.has(pathname)) return IMMUTABLE_CACHE;
	if (pathname === '/service-worker.js') return NO_CACHE;
	if (SHORT_PATHS.has(pathname) || pathname.startsWith('/social/')) return SHORT_CACHE;
	return null;
}
