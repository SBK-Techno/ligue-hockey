import { self } from '$app/service-worker';
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { resolve } from '$app/paths';
import { branding } from '#lib/generated/branding.ts';

const CACHE = `${branding.cachePrefix}-${version}`;
const ASSETS = [
	...new Set([
		...immutable.map((asset) => resolve(asset.path)),
		...assets.map((asset) => resolve(asset.path)),
		branding.offlinePath
	])
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
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
			const cache = await caches.open(CACHE);
			if (ASSETS.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			try {
				// Authenticated HTML and data are never stored in the shared
				// cache; only the public assets above are available offline.
				return await fetch(request);
			} catch (error) {
				if (request.mode === 'navigate') {
					const offline = await cache.match(branding.offlinePath);
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
