(async () => {
  const request = new URL(location.href).searchParams.get('request');
  if (!request || parent === self) return;
  let timer;
  let onChange;
  let onState;
  let worker;
  let cancelled = false;
  const workers = navigator.serviceWorker;
  try {
    if (!workers) throw new Error('Service workers unavailable');
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Connection timed out')), 12000);
    });
    await Promise.race([(async () => {
      const registration = await workers.register('/servy.js', { type: 'classic', updateViaCache: 'none' });
      if (registration.waiting) await registration.update();
      async function waitForControl() {
        if (cancelled) return;
        worker = registration.installing || registration.waiting || registration.active;
        if (!worker) throw new Error('No app worker');
        if (worker.state !== 'activated') {
          let activationRequested = false;
          await new Promise((resolve, reject) => {
            onState = () => {
              if (worker.state === 'installed' && !activationRequested) {
                activationRequested = true;
                worker.postMessage({ type: 'velora:activate-worker' });
              }
              if (!['activated', 'redundant'].includes(worker.state)) return;
              worker.removeEventListener('statechange', onState);
              onState = undefined;
              if (worker.state === 'activated') resolve();
              else reject(new Error('App worker update failed'));
            };
            worker.addEventListener('statechange', onState);
            onState();
          });
        }
        if (cancelled) return;
        if (workers.controller !== worker) {
          await new Promise(resolve => {
            onChange = () => {
              if (workers.controller !== worker) return;
              workers.removeEventListener('controllerchange', onChange);
              onChange = undefined;
              resolve();
            };
            workers.addEventListener('controllerchange', onChange);
            onChange();
          });
        }
      }
      await waitForControl();
      if (cancelled) return;
      // A matching controller URL alone does not prove fetch interception works.
      // This response is produced only by Velora's worker, never the site host.
      async function routingReady() {
        const response = await fetch(`/__velora_proxy_ready?request=${encodeURIComponent(request)}`, { cache: 'no-store' });
        return response.ok && response.headers.get('X-Velora-Proxy-Ready') === '1' && await response.text() === request;
      }
      if (!await routingReady()) {
        if (cancelled) return;
        // register() can resolve with the old active worker before an update
        // begins. Complete one explicit update before retrying this safe probe.
        await registration.update();
        await waitForControl();
        if (cancelled) return;
        if (!await routingReady()) throw new Error('App routing is unavailable');
      }
    })(), deadline]);
    if (!cancelled) parent.postMessage({ type: 'velora:frame-ready', request }, location.origin);
  } catch {
    parent.postMessage({ type: 'velora:frame-ready', request, error: true }, location.origin);
  } finally {
    cancelled = true;
    clearTimeout(timer);
    if (onChange) workers.removeEventListener('controllerchange', onChange);
    if (onState) worker.removeEventListener('statechange', onState);
  }
})();
