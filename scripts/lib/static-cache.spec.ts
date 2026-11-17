import { describe, expect, it } from 'vitest';
import {
	IMMUTABLE_CACHE,
	NO_CACHE,
	SHORT_CACHE,
	cachePolicyFor,
	generatedAssetPaths
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
