// Register routing and lifecycle handlers in the entry script before loading
// engine bundles. Safari must discover them during the worker's first evaluation.
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data?.type === 'velora:activate-worker') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', (event) => {
  // respondWith must run synchronously, even when controller recovery is async.
  event.respondWith(routeRequest(event));
});

importScripts('/glass/glass.bundle.js');
importScripts('/glass/glass.config.js');
importScripts('/glass/glass.sw.js');
importScripts('/poly/polygon.all.js');
importScripts('/prism/stream-transfer.js', '/prism/prism.sw.js');
importScripts('/proxy-route-recovery.js');
const uv = new UVServiceWorker();
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

async function routeRequest(event) {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname === '/__velora_proxy_ready' && event.request.method === 'GET') {
    return new Response(url.searchParams.get('request') || '', {
      headers: { 'X-Velora-Proxy-Ready': '1', 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }
    });
  }
  if ($scramjetController.shouldRoute(event)) {
    return $scramjetController.route(event);
  }
  if (self.isPrismProxyRequest(event.request.url)) {
    // A restarted worker has forgotten its controller. Keep the original
    // request, including its method and body, while reconnecting the owner.
    return self.recoverPrismProxyRoute(event, $scramjetController);
  }
  if (uv.route(event)) return uv.fetch(event);
  if (new URL(event.request.url).pathname.startsWith('/polygon/')) {
    await scramjet.loadConfig();
    if (scramjet.route(event)) return scramjet.fetch(event);
  }
  return fetch(event.request);
}
