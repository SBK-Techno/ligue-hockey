import { self } from '$app/service-worker';
import { version } from '$app/env';
import { immutable } from '$app/manifest';
import { resolve } from '$app/paths';
import { branding } from '#lib/generated/branding.ts';
import { precachePaths } from './precache.ts';

const CACHE = `${branding.cachePrefix}-${version}`;
const RUNTIME = `${CACHE}-runtime`;

/**
 * La coquille installée est volontairement courte : les morceaux immuables de
 * l'application, la page hors ligne et les icônes du manifeste. La photo de
 * connexion, l'aperçu social et les textures restent hors installation; ils
 * entrent dans le cache d'exécution seulement quand une page les demande.
 */
const PRECACHE = precachePaths(
	immutable.map((asset) => resolve(asset.path)),
	branding
);
const PRECACHED = new Set(PRECACHE);

/** Les médias nommés par contenu peuvent être resservis sans réseau. */
const RUNTIME_PREFIXES = ['/icons/', '/textures/', '/auth/', '/identities/', '/social/'];

function isRuntimeAsset(pathname: string): boolean {
	return RUNTIME_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(PRECACHE);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE && key !== RUNTIME) await caches.delete(key);
			}
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

	event.respondWith(
		(async () => {
			if (PRECACHED.has(url.pathname)) {
				const cached = await caches.match(url.pathname);
				if (cached) return cached;
			}

			if (isRuntimeAsset(url.pathname)) {
				const runtime = await caches.open(RUNTIME);
				const cached = await runtime.match(url.pathname);
				if (cached) return cached;
				const response = await fetch(request);
				if (response.ok) await runtime.put(url.pathname, response.clone());
				return response;
			}

			try {
				// Le HTML et les données de session ne sont jamais stockés dans
				// le cache partagé; seule la coquille publique est disponible
				// hors ligne.
				return await fetch(request);
			} catch (error) {
				if (request.mode === 'navigate') {
					const offline = await caches.match(branding.offlinePath);
					if (offline) return offline;
				}
				throw error;
			}
		})()
	);
});

self.addEventListener('push', (event) => {
	if (!event.data) return;
	let payload = {
		title: branding.name,
		body: '',
		url: branding.startUrl,
		tag: branding.shortName
	};
	try {
		payload = { ...payload, ...event.data.json() };
	} catch {
		payload.body = event.data.text();
	}

	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			tag: payload.tag,
			icon: branding.icons.icon192,
			badge: branding.icons.favicon,
			data: { url: payload.url }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL(
		typeof event.notification.data?.url === 'string'
			? event.notification.data.url
			: branding.startUrl,
		self.location.origin
	).href;

	event.waitUntil(
		(async () => {
			const clients = await self.clients.matchAll({
				type: 'window',
				includeUncontrolled: true
			});
			for (const client of clients) {
				if (client.url === target && 'focus' in client) {
					await client.focus();
					return;
				}
			}
			await self.clients.openWindow(target);
		})()
	);
});
