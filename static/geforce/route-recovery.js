(() => {
  const registered = new Set();
  let revival;

  self.addEventListener('message', ({ data }) => {
    if (typeof data?.$controller$init?.id === 'string') registered.add(data.$controller$init.id);
  });

  self.isGeForceProxyRequest = (url) => {
    const parsed = new URL(url);
    return parsed.origin === self.location.origin && /^\/geforce\/proxy\/[^/]+\/[^/]+\//.test(parsed.pathname);
  };

  async function reviveClients() {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (!new URL(client.url).pathname.startsWith('/geforce/')) continue;
      client.postMessage({ $controller$swrevive: { registered: [...registered] } });
    }
  }

  self.recoverGeForceProxyRoute = async (event, controller, timeoutMs = 5000) => {
    if (!revival) revival = reviveClients().finally(() => { revival = undefined; });
    await revival;
    const deadline = Date.now() + timeoutMs;
    while (!controller.shouldRoute(event) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (controller.shouldRoute(event)) return controller.route(event);
    // Never hand a stale proxy URL to the static host and show a misleading 404.
    return new Response('The GeForce connection expired. Return to the GeForce page and refresh to reconnect.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  };
})();
