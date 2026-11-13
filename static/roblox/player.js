(() => {
  const nonce = new URLSearchParams(location.search).get('nonce');
  const bridge = self.__veloraRobloxBridge;
  let started = false;
  let rendered = false;
  let failed = false;
  let connectionContext = {};
  let engineVersion = 'unknown';
  const reportTools = document.getElementById('connection-report-tools');
  const reportButton = document.getElementById('connection-report-copy');
  const reportStatus = document.getElementById('connection-report-status');
  const reportText = document.getElementById('connection-report-text');
  function showReportTools(panel) {
    if (!reportTools) return;
    if (!panel.contains(reportTools)) panel.appendChild(reportTools);
    reportTools.hidden = false;
  }
  function connectionReport() {
    const snapshot = bridge.connectionSnapshot?.() || {};
    const count = value => Number.isInteger(value) && value >= 0 && value <= 100000 ? value : 0;
    const http = value => Number.isInteger(value) && value >= 100 && value <= 599 ? value : 'not observed';
    const code = document.getElementById('loading-error-code')?.textContent?.match(/\b\d{3}\b/)?.[0] || 'not shown';
    const transport = ['libcurl', 'epoxy'].includes(connectionContext.transport) ? connectionContext.transport : 'unknown';
    const relay = ['default', 'custom'].includes(connectionContext.relay) ? connectionContext.relay : 'unknown';
    const game = ['not-started', 'connecting', 'connected', 'failed', 'closed'].includes(snapshot.game) ? snapshot.game : 'unknown';
    // This deliberately excludes raw messages, URLs, tickets, game/server IDs,
    // account identifiers, cookies and the contents of requests/responses.
    return [
      'Velblox connection report v1',
      `Site: ${new URL(location.href).hostname}`,
      `Engine: ${engineVersion}`,
      `Relay: ${relay}`,
      `Transport: ${transport}`,
      `Signed in before launch: ${connectionContext.signedIn === true ? 'yes' : connectionContext.signedIn === false ? 'no' : 'unknown'}`,
      `Shared memory: ${crossOriginIsolated ? 'yes' : 'no'}`,
      `WebTransport available: ${typeof self.WebTransport === 'function' ? 'yes' : 'no'}`,
      `Wasm JSPI available: ${typeof WebAssembly.Suspending === 'function' && typeof WebAssembly.promising === 'function' ? 'yes' : 'no'}`,
      `Game connection: ${game}`,
      `Game attempts: ${count(snapshot.attempts)}; connected: ${count(snapshot.connected)}; failed: ${count(snapshot.failed)}`,
      `Game join HTTP: ${http(snapshot.joinHttp)}`,
      `Game join result: ${Number.isInteger(snapshot.joinResult) && snapshot.joinResult >= 0 && snapshot.joinResult <= 100000 ? snapshot.joinResult : 'not observed'}`,
      `Last HTTP failure: ${snapshot.httpFailure === 'network-error' ? 'network-error' : http(snapshot.httpFailure)}`,
      `Roblox error code: ${code}`
    ].join('\n');
  }
  if (reportButton) reportButton.onclick = async () => {
    const text = connectionReport();
    try {
      await navigator.clipboard.writeText(text);
      reportStatus.textContent = 'Report copied. Paste it into your support chat.';
    } catch {
      reportText.hidden = false; reportText.value = text; reportText.focus(); reportText.select();
      reportStatus.textContent = 'Copy the report below and paste it into your support chat.';
    }
  };
  function cancel() {
    parent.postMessage({ type: 'velora:roblox-cancel', nonce }, location.origin);
  }
  document.getElementById('loading-cancel').onclick = cancel;
  document.getElementById('loading-error-leave').onclick = cancel;

  // Artwork uses the same Roblox connection as the engine. Local blob URLs
  // keep images compatible with the game window's shared-memory isolation.
  for (const id of ['loading-experience-icon', 'loading-background-image']) {
    const image = document.getElementById(id);
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    let revision = 0;
    let blobUrl;
    Object.defineProperty(image, 'src', {
      get() { return src.get.call(image); },
      set(value) {
        const current = ++revision;
        const url = new URL(value, location.href);
        if (url.origin === location.origin || url.protocol === 'blob:') { src.set.call(image, url.href); return; }
        if (url.protocol !== 'https:' || !/(^|\.)rbxcdn\.com$/.test(url.hostname) || url.username || url.password || url.port) return;
        fetch(url.href).then(response => {
          if (!response.ok) throw new Error('Artwork unavailable');
          return response.blob();
        }).then(blob => {
          if (current !== revision) return;
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          blobUrl = URL.createObjectURL(blob);
          src.set.call(image, blobUrl);
        }).catch(() => { if (current === revision) image.dispatchEvent(new Event('error')); });
      }
    });
    image.addEventListener('load', () => image.parentElement.classList.add('loading-image-ready'));
    window.addEventListener('pagehide', () => { revision++; if (blobUrl) URL.revokeObjectURL(blobUrl); }, { once: true });
  }
  function failure(text) {
    if (failed) return;
    failed = true;
    const overlay = document.getElementById('loading-overlay');
    overlay.hidden = false;
    overlay.style.display = '';
    overlay.classList.remove('loading-exiting');
    overlay.classList.add('loading-failed');
    overlay.setAttribute('aria-busy', 'false');
    const panel = document.querySelector('.loading-error-panel');
    panel.hidden = false;
    showReportTools(panel);
    document.getElementById('loading-error-title').textContent = 'Unable to join';
    document.getElementById('loading-error-message').textContent = text;
    document.getElementById('status').textContent = text;
    bridge.status('error', text);
  }
  function startupFailure(error) {
    if (!started || rendered) return;
    const message = String(error?.message || error || '');
    if (/out of memory|allocation|WebAssembly\.Memory|memory access out of bounds|cannot (?:enlarge|grow) memory/i.test(message)) {
      failure('The Roblox engine encountered a memory error. Close other tabs and apps, then try again.');
    } else if (/webgl|graphics context|getSupportedExtensions/i.test(message)) {
      failure('Roblox could not start its graphics engine on this browser. Update your browser and try again.');
    } else {
      failure('The Roblox engine stopped during startup. Reload and try again.');
    }
  }
  window.addEventListener('error', event => { if (event.error) startupFailure(event.error); });
  window.addEventListener('unhandledrejection', event => startupFailure(event.reason));
  function load(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = url;
      script.onload = resolve; script.onerror = () => reject(new Error('Could not load a Roblox engine file.'));
      document.head.append(script);
    });
  }
  window.addEventListener('message', async event => {
    if (started || event.source !== parent || event.origin !== location.origin ||
      event.data?.type !== 'velora:roblox-connect' || event.data.nonce !== nonce || !event.ports[0]) return;
    started = true;
    bridge.connect(event.ports[0]);
    connectionContext = event.data.connection || {};
    engineVersion = typeof event.data.build?.version === 'string' && /^\d+(?:\.\d+){1,4}$/.test(event.data.build.version) ? event.data.build.version : 'unknown';
    try {
      if (!crossOriginIsolated) throw new Error('The game window could not enable shared memory.');
      window.__wasmLoaderContext = {
        engineBase: location.origin + '/roblox/engine', server: 'prod', channel: null,
        workerStubUrl: location.origin + '/roblox/engine-worker.js'
      };
      // Authentication stays in Velora's existing session jar. The engine never
      // receives an account cookie through a setting, input box, or URL.
      window.__wasmDevSettings = {
        baseUrl: 'www.roblox.com', authCookie: 'managed-by-velora',
        isCookieFromPool: () => false, getFlagOverrides: () => ({}),
        apiProxy: { url: url => url, authHeaders: () => ({}) }
      };
      window.close = cancel;
      const overlay = document.getElementById('loading-overlay');
      const status = document.getElementById('status');
      new MutationObserver(() => {
        if (status.textContent) bridge.status('loading', status.textContent);
        if (overlay.classList.contains('hidden') || overlay.hidden || overlay.style.display === 'none') {
          rendered = true;
          bridge.status('rendered', 'Experience started');
        }
      }).observe(overlay, { subtree: true, childList: true, attributes: true, characterData: true });
      await load('/roblox/engine/WasmPlayer.js');
      const errors = document.querySelector('.loading-error-panel');
      new MutationObserver(() => {
        const text = document.getElementById('loading-error-message')?.textContent;
        if (text) { showReportTools(errors); bridge.status('error', text.slice(0, 400)); }
      }).observe(errors, { subtree: true, childList: true, characterData: true });
    } catch (error) { failure(error.message || 'Could not start the Roblox engine.'); }
  });
  parent.postMessage({ type: 'velora:roblox-ready', nonce }, location.origin);
})();
