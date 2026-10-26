(async () => {
  const request = new URL(location.href).searchParams.get('request');
  if (!request || parent === self) return;
  let timer;
  let onChange;
  let cancelled = false;
  const workers = navigator.serviceWorker;
  try {
    if (!workers) throw new Error('Service workers unavailable');
    const expected = new URL('/servy.js', location.href).href;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Connection timed out')), 12000);
    });
    await Promise.race([(async () => {
      if (!workers.controller || workers.controller.scriptURL !== expected) {
        await workers.register('/servy.js', { type: 'classic', updateViaCache: 'none' });
        await workers.ready;
        if (cancelled) return;
        await new Promise(resolve => {
          onChange = () => {
            if (workers.controller?.scriptURL === expected) resolve();
          };
          workers.addEventListener('controllerchange', onChange);
          onChange();
        });
      }
    })(), deadline]);
    parent.postMessage({ type: 'velora:frame-ready', request }, location.origin);
  } catch {
    parent.postMessage({ type: 'velora:frame-ready', request, error: true }, location.origin);
  } finally {
    cancelled = true;
    clearTimeout(timer);
    if (onChange) workers.removeEventListener('controllerchange', onChange);
  }
})();
