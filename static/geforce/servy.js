self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data?.type === 'velora:activate-worker') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', (event) => {
  if (new URL(event.request.url).pathname.startsWith('/geforce/proxy/')) {
    event.respondWith(routeGeForceRequest(event));
  }
});

importScripts('/prism/stream-transfer.js', '/geforce-runtime/prism.sw.js', '/geforce/route-recovery.js');

async function routeGeForceRequest(event) {
  if ($scramjetController.shouldRoute(event)) return $scramjetController.route(event);
  return self.recoverGeForceProxyRoute(event, $scramjetController);
}
