import { createServer, type Server } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
	IMMUTABLE_CACHE,
	NO_CACHE,
	SHORT_CACHE,
	cachePolicyFor,
	generatedAssetPaths,
	installStaticCachePolicy
} from './static-cache.js';

const manifest = {
	files: {
		'static/icons/favicon-32.abcdef123456.png': 'x',
		'static/auth/dressing-room-640-abcdef123456.webp': 'x',
		'static/textures/paper-abcdef123456.webp': 'x',
		'static/identities/identities-abcdef123456.svg': 'x',
		'static/social/apercu-abcdef123456.jpg': 'x',
		'static/offline.html': 'x',
		'static/generated-assets.json': 'x',
		'src/app.html': 'x'
	}
};

const immutable = generatedAssetPaths(manifest);

function listening(server: Server): Promise<string> {
	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				throw new Error('Adresse de test inattendue.');
			}
			resolve(`http://127.0.0.1:${address.port}`);
		});
	});
}

function closed(server: Server): Promise<void> {
	return new Promise((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
}

describe('cache des actifs générés', () => {
	it('classe seulement les médias nommés par contenu', () => {
		expect([...immutable].sort()).toEqual([
			'/auth/dressing-room-640-abcdef123456.webp',
			'/icons/favicon-32.abcdef123456.png',
			'/identities/identities-abcdef123456.svg',
			'/social/apercu-abcdef123456.jpg',
			'/textures/paper-abcdef123456.webp'
		]);
	});

	it('pose la politique sur le serveur de l’entrée de production', async () => {
		const server = createServer((_request, response) => {
			response.writeHead(200, { 'content-type': 'image/png' });
			response.end('ok');
		});
		installStaticCachePolicy(server, manifest);
		const base = await listening(server);
		try {
			const requests: [string, string | null][] = [];
			for (const pathname of [
				'/icons/favicon-32.abcdef123456.png',
				'/manifest.webmanifest',
				'/service-worker.js'
			]) {
				const response = await fetch(`${base}${pathname}`);
				requests.push([pathname, response.headers.get('cache-control')]);
			}
			expect(requests).toEqual([
				['/icons/favicon-32.abcdef123456.png', IMMUTABLE_CACHE],
				['/manifest.webmanifest', SHORT_CACHE],
				['/service-worker.js', NO_CACHE]
			]);
		} finally {
			await closed(server);
		}
	});

	it.each([
		['/icons/favicon-32.abcdef123456.png', IMMUTABLE_CACHE],
		['/auth/dressing-room-640-abcdef123456.webp', IMMUTABLE_CACHE],
		['/textures/paper-abcdef123456.webp', IMMUTABLE_CACHE],
		['/identities/identities-abcdef123456.svg', IMMUTABLE_CACHE],
		['/service-worker.js', NO_CACHE],
		['/generated-assets.json', SHORT_CACHE],
		['/manifest.webmanifest', SHORT_CACHE],
		['/offline.html', SHORT_CACHE],
		['/robots.txt', SHORT_CACHE],
		['/social/apercu-abcdef123456.jpg', IMMUTABLE_CACHE],
		['/social/apercu.jpg', SHORT_CACHE],
		['/_app/immutable/entry/app.js', null]
	])('politique de %s', (pathname, expected) => {
		expect(cachePolicyFor(pathname, immutable)).toBe(expected);
	});
});
