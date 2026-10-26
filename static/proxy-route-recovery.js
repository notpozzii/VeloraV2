(() => {
  const registered = new Set();
  let revival;

  self.addEventListener('message', ({ data }) => {
    if (typeof data?.$controller$init?.id === 'string') registered.add(data.$controller$init.id);
  });

  self.isPrismProxyRequest = (url) => {
    const parsed = new URL(url);
    return parsed.origin === self.location.origin && /^\/prism\/[^/]+\/[^/]+\//.test(parsed.pathname);
  };

  async function reviveClients() {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      const url = new URL(client.url);
      if (url.origin !== self.location.origin || url.pathname.startsWith('/geforce/')) continue;
      client.postMessage({ $controller$swrevive: { registered: [...registered] } });
    }
  }

  self.recoverPrismProxyRoute = async (event, controller, timeoutMs = 5000) => {
    if (!revival) revival = reviveClients().finally(() => { revival = undefined; });
    await revival;
    const deadline = Date.now() + timeoutMs;
    while (!controller.shouldRoute(event) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (controller.shouldRoute(event)) return controller.route(event);
    return new Response('The browser connection expired. Refresh Velora to reconnect.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  };
})();
