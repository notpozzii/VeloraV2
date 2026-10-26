(() => {
  const key = 'velora:reconnect:' + location.pathname + location.search;
  const retry = document.querySelector('#retry');
  const status = document.querySelector('#status');
  let stopped = false;
  let cancelControlWait;
  retry.onclick = () => {
    try { sessionStorage.removeItem(key); } catch {}
    location.reload();
  };
  const fail = () => {
    stopped = true;
    cancelControlWait?.();
    status.textContent = 'The browser connection is not ready. Try again or reopen the Browser app.';
    retry.hidden = false;
  };
  async function reconnect() {
    // Bound this to one automatic GET retry. Never resubmit a form or upload.
    if (sessionStorage.getItem(key)) return fail();
    sessionStorage.setItem(key, '1');
    if (!navigator.serviceWorker) return fail();
    const geforce = location.pathname.startsWith('/geforce/');
    await navigator.serviceWorker.register(geforce ? '/geforce/servy.js' : '/servy.js', {
      type: 'classic', updateViaCache: 'none', scope: geforce ? '/geforce/' : '/'
    });
    await navigator.serviceWorker.ready;
    if (stopped) return;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        const change = () => {
          if (!navigator.serviceWorker.controller) return;
          navigator.serviceWorker.removeEventListener('controllerchange', change);
          resolve();
        };
        cancelControlWait = () => { navigator.serviceWorker.removeEventListener('controllerchange', change); resolve(); };
        navigator.serviceWorker.addEventListener('controllerchange', change);
        change();
      });
    }
    if (!stopped) location.reload();
  }
  const timer = setTimeout(fail, 8000);
  reconnect().catch(fail).finally(() => clearTimeout(timer));
})();
