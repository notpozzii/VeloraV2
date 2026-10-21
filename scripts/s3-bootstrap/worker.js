// Only the S3 export imports this helper. Proxy routing stays in servy.js.
const VELORA_CONTROL = 'velora-static-control';
const VELORA_CURRENT = '/__velora_release__';
const veloraCacheName = version => `velora-static-${version}`;
const veloraAssetPaths = new Set(self.VELORA_STATIC_ASSETS);

async function veloraCurrent() {
	const response = await (await caches.open(VELORA_CONTROL)).match(VELORA_CURRENT);
	return response ? response.json() : null;
}

self.veloraStaticRequest = function (event) {
	const request = event.request;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== self.location.origin) return null;
	// The proxy controller is not initialized while the downloader is running.
	// Bootstrap traffic and local page routes must bypass the proxy handler.
	if (self.VELORA_STATIC_ROUTES?.includes(url.pathname) ||
		/^\/velora-(?:release\.json|bootstrap\.js|static-worker\.js|bundle\.[a-f0-9]+\.gz)$/.test(url.pathname) ||
		['/servy.js', '/favicon.ico'].includes(url.pathname)) return fetch(request);
	// These prefixes are proxy traffic, never offline app assets.
	if (url.pathname.startsWith('/service/') || url.pathname.startsWith('/scramjet/')) return null;
	// Prism session URLs live beside its static scripts. Only exact exported assets
	// qualify for caching; all dynamic proxy URLs continue through the original worker.
	if (!veloraAssetPaths.has(url.pathname) && !url.pathname.startsWith('/_app/immutable/')) return null;
	return (async () => {
		const release = await veloraCurrent();
		if (!release) return fetch(request);
		const cache = await caches.open(veloraCacheName(release.version));
		const existing = await cache.match(url.pathname);
		if (existing) return existing;
		// An older tab can still request an immutable chunk from the prior build.
		if (url.pathname.startsWith('/_app/immutable/')) {
			for (const name of await caches.keys()) {
				if (!name.startsWith('velora-static-') || name === VELORA_CONTROL) continue;
				const old = await (await caches.open(name)).match(url.pathname);
				if (old) return old;
			}
		}
		if (!release.assets[url.pathname]) return fetch(request);
		const response = await fetch(request);
		if (response.ok && response.type !== 'opaque') {
			try { await cache.put(url.pathname, response.clone()); }
			catch { /* Storage limits must not prevent online use. */ }
		}
		return response;
	})();
};

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
