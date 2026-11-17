/**
 * La politique de cache des fichiers statiques générés. Le manifeste
 * `static/generated-assets.json` est le propriétaire des noms; ce module ne
 * fait que classer les préfixes produits par le générateur.
 */
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
export const SHORT_CACHE = 'public, max-age=300';
export const NO_CACHE = 'no-cache';
/**
 * La valeur posée par l'adaptateur SvelteKit pour `/_app/immutable`. Le smoke
 * l'affirme sans la recopier; elle n'est jamais appliquée par ce module.
 */
export const FRAMEWORK_IMMUTABLE_CACHE = 'public,max-age=31536000,immutable';

const IMMUTABLE_PREFIXES = ['/icons/', '/auth/', '/textures/', '/identities/', '/social/'];
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
	// Le chemin social historique n'est plus nommé par contenu; un actif
	// remplacé garde un cache court, jamais immuable.
	if (SHORT_PATHS.has(pathname) || pathname.startsWith('/social/')) return SHORT_CACHE;
	return null;
}

/**
 * Installe la politique sur le serveur HTTP de l'adaptateur. Le point
 * d'entrée `serve.js` l'appelle avant d'écouter; aucun autre point d'entrée
 * n'est supporté, parce que le serveur nu ne connaît pas les noms générés.
 * La politique est posée sur l'écriture des en-têtes, donc elle couvre aussi
 * les fichiers statiques servis avant le routeur SvelteKit.
 */
export function installStaticCachePolicy(server, manifest) {
	const immutable = generatedAssetPaths(manifest);
	server.prependListener('request', (req, res) => {
		const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
		const policy = cachePolicyFor(pathname, immutable);
		if (!policy) return;

		const writeHead = res.writeHead;
		res.writeHead = function (status, statusMessage, headers) {
			if (statusMessage && typeof statusMessage === 'object') {
				headers = statusMessage;
				statusMessage = undefined;
			}
			const merged = { ...(headers ?? {}) };
			if (!Object.keys(merged).some((name) => name.toLowerCase() === 'cache-control')) {
				merged['cache-control'] = policy;
			}
			return writeHead.call(this, status, statusMessage, merged);
		};
	});
}
