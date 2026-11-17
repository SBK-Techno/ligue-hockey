/**
 * Le point d'entrée de production. L'adaptateur Node sert les fichiers et les
 * pages; ce wrapper maintient une seule politique de cache pour les médias
 * générés nommés par contenu, sans modifier le serveur généré.
 */
import { readFileSync } from 'node:fs';
import { server } from './build/index.js';
import { cachePolicyFor, generatedAssetPaths } from './scripts/lib/static-cache.js';

const manifest = JSON.parse(
	readFileSync(new URL('./build/client/generated-assets.json', import.meta.url), 'utf8')
);
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
