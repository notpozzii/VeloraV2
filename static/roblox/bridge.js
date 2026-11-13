/* Velora's browser/engine bridge. Shared by the page and engine threads. */
(() => {
  const nativeFetch = self.fetch.bind(self);
  const NativeXHR = self.XMLHttpRequest;
  let port;
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  const requests = new Map();
  let sequence = 0;
  // Keep only connection stages and numeric HTTP results. Never retain game
  // addresses (which contain tickets), cookies, response bodies or errors.
  const connection = { game: 'not-started', attempts: 0, connected: 0, failed: 0, joinHttp: null, joinResult: null, httpFailure: null };
  const gameStates = ['connecting', 'connected', 'failed', 'closed'];
  function observeConnection(data) {
    if (data.kind === 'game' && gameStates.includes(data.state)) {
      connection.game = data.state;
      if (data.state === 'connecting') connection.attempts++;
      if (data.state === 'connected') connection.connected++;
      if (data.state === 'failed') connection.failed++;
    } else if (data.kind === 'join' && Number.isInteger(data.status) && data.status >= 100 && data.status <= 599) {
      connection.joinHttp = data.status;
      if (Number.isInteger(data.result) && data.result >= 0 && data.result <= 100000) connection.joinResult = data.result;
    } else if (data.kind === 'http' && (data.status === 'network-error' || Number.isInteger(data.status) && data.status >= 400 && data.status <= 599)) {
      connection.httpFailure = data.status;
    } else return;
    if (typeof document === 'undefined') port?.postMessage({ type: 'velora:roblox-connection', kind: data.kind, state: data.state, status: data.status, result: connection.joinResult });
  }
  const NativeWebTransport = self.WebTransport;
  if (typeof NativeWebTransport === 'function') {
    self.WebTransport = class extends NativeWebTransport {
      constructor(...args) {
        super(...args);
        observeConnection({ kind: 'game', state: 'connecting' });
        // Observe the native promises without replacing the connection,
        // changing its destination, or changing the result the engine sees.
        this.ready.then(() => observeConnection({ kind: 'game', state: 'connected' }), () => observeConnection({ kind: 'game', state: 'failed' }));
        this.closed.then(() => observeConnection({ kind: 'game', state: 'closed' }), () => {});
      }
    };
  }
  const remote = value => {
    try {
      const url = new URL(value, self.location.href);
      return url.protocol === 'https:' && /(^|\.)(roblox\.com|rbxcdn\.com)$/.test(url.hostname);
    } catch { return false; }
  };
  function connect(next) {
    if (port) return;
    port = next;
    port.onmessage = ({ data }) => {
      if (data.type !== 'response') return;
      const pending = requests.get(data.id);
      if (!pending) return;
      requests.delete(data.id);
      clearTimeout(pending.timer);
      if (data.error) { observeConnection({ kind: 'http', status: 'network-error' }); pending.reject(new Error(data.error)); }
      else {
        if (pending.join) {
          let result;
          try { result = JSON.parse(new TextDecoder().decode(data.result.body)).status; } catch {}
          observeConnection({ kind: 'join', status: data.result?.status, result });
        }
        if (data.result?.status >= 400) observeConnection({ kind: 'http', status: data.result.status });
        pending.resolve(data.result);
      }
    };
    readyResolve();
  }
  async function request(url, init = {}) {
    await ready;
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { requests.delete(id); reject(new Error('The Roblox request timed out.')); }, 60000);
      let join = false;
      try { join = new URL(url).hostname === 'gamejoin.roblox.com'; } catch {}
      requests.set(id, { resolve, reject, timer, join });
      port.postMessage({ type: 'request', id, url, init });
    });
  }
  function response(result, method) {
    return new Response(method === 'HEAD' || [204, 205, 304].includes(result.status) ? null : result.body,
      { status: result.status, statusText: result.statusText, headers: result.headers });
  }
  self.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!remote(url)) return nativeFetch(input, init);
    const req = new Request(input, init);
    const result = await request(req.url, { method: req.method, headers: Array.from(req.headers),
      body: ['GET', 'HEAD'].includes(req.method) ? null : await req.arrayBuffer() });
    return response(result, req.method);
  };

  class EngineXHR extends EventTarget {
    constructor() {
      super();
      this.upload = new EventTarget();
      this._xhr = new NativeXHR();
      this._headers = new Headers();
      this._readyState = 0;
      this._status = 0;
      this._response = null;
      this._responseText = '';
      this._responseType = '';
      this._responseHeaders = new Headers();
      this.timeout = 0;
      this.withCredentials = false;
      for (const type of ['loadstart', 'readystatechange', 'progress', 'load', 'loadend', 'error', 'abort', 'timeout']) {
        this._xhr.addEventListener(type, event => this._fire(type, event));
      }
    }
    _fire(type, source) {
      const event = new ProgressEvent(type, { lengthComputable: source?.lengthComputable || false,
        loaded: source?.loaded || 0, total: source?.total || 0 });
      this.dispatchEvent(event);
      if (typeof this['on' + type] === 'function') this['on' + type].call(this, event);
    }
    open(method, url, async = true, ...args) {
      this._url = new URL(url, self.location.href).href;
      this._method = String(method).toUpperCase();
      this._remote = remote(this._url);
      this._aborted = false;
      if (!this._remote) return this._xhr.open(method, url, async, ...args);
      if (!async) throw new DOMException('Synchronous Roblox network requests are unsupported.', 'NotSupportedError');
      this._headers = new Headers(); this._readyState = 1; this._fire('readystatechange');
    }
    setRequestHeader(key, val) { this._remote ? this._headers.append(key, val) : this._xhr.setRequestHeader(key, val); }
    getAllResponseHeaders() { return this._remote ? Array.from(this._responseHeaders, ([k, v]) => `${k}: ${v}\r\n`).join('') : this._xhr.getAllResponseHeaders(); }
    getResponseHeader(name) { return this._remote ? this._responseHeaders.get(name) : this._xhr.getResponseHeader(name); }
    overrideMimeType(value) { if (!this._remote) this._xhr.overrideMimeType(value); }
    abort() { this._aborted = true; if (!this._remote) return this._xhr.abort(); this._readyState = 0; this._fire('abort'); this._fire('loadend'); }
    async send(body = null) {
      if (!this._remote) {
        this._xhr.responseType = this._responseType; this._xhr.timeout = this.timeout;
        this._xhr.withCredentials = this.withCredentials; return this._xhr.send(body);
      }
      this._fire('loadstart');
      let timer;
      try {
        const job = request(this._url, { method: this._method, headers: Array.from(this._headers),
          body: body == null ? null : await new Response(body).arrayBuffer() });
        const result = await (this.timeout > 0 ? Promise.race([job, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new DOMException('Request timed out.', 'TimeoutError')), this.timeout);
        })]) : job);
        if (this._aborted) return;
        this._status = result.status; this._statusText = result.statusText; this._responseURL = result.url;
        this._responseHeaders = new Headers(result.headers); this._readyState = 2; this._fire('readystatechange');
        const bytes = result.body || new ArrayBuffer(0);
        // Binary assets can be large. Decoding them into unused JS strings
        // duplicates their memory while the engine is still starting.
        this._responseText = ['arraybuffer', 'blob'].includes(this._responseType) ? '' : new TextDecoder().decode(bytes);
        this._response = this._responseType === 'arraybuffer' ? bytes : this._responseType === 'blob'
          ? new Blob([bytes], { type: this._responseHeaders.get('content-type') || '' }) : this._responseType === 'json'
            ? (() => { try { return JSON.parse(this._responseText); } catch { return null; } })() : this._responseText;
        this._readyState = 4; this._fire('readystatechange');
        this._fire('progress', { loaded: bytes.byteLength, total: bytes.byteLength, lengthComputable: true });
        this._fire('load'); this._fire('loadend');
      } catch (error) {
        port?.postMessage({ type: 'status', phase: 'diagnostic', text: `XHR ${new URL(this._url).hostname}: ${error.message || error.name}` });
        if (!this._aborted) { this._readyState = 4; this._fire('readystatechange'); this._fire(error.name === 'TimeoutError' ? 'timeout' : 'error'); this._fire('loadend'); }
      } finally { clearTimeout(timer); }
    }
    get readyState() { return this._remote ? this._readyState : this._xhr.readyState; }
    get status() { return this._remote ? this._status : this._xhr.status; }
    get statusText() { return this._remote ? this._statusText || '' : this._xhr.statusText; }
    get responseURL() { return this._remote ? this._responseURL || '' : this._xhr.responseURL; }
    get response() { return this._remote ? this._response : this._xhr.response; }
    get responseText() { return this._remote ? this._responseText : this._xhr.responseText; }
    get responseXML() { return this._remote ? null : this._xhr.responseXML; }
    get responseType() { return this._responseType; }
    set responseType(value) { this._responseType = value; }
  }
  for (const [key, value] of Object.entries({ UNSENT: 0, OPENED: 1, HEADERS_RECEIVED: 2, LOADING: 3, DONE: 4 })) {
    EngineXHR[key] = value; EngineXHR.prototype[key] = value;
  }
  self.XMLHttpRequest = EngineXHR;
  self.__veloraRobloxBridge = { connect, request,
    connectionSnapshot() { return Object.freeze({ ...connection }); },
    status(phase, text) { port?.postMessage({ type: 'status', phase, text }); },
    exit() { port?.postMessage({ type: 'exit' }); } };

  if (typeof document === 'undefined') {
    self.addEventListener('message', event => {
      if (event.data?.type !== 'velora:roblox-worker-connect' || !event.ports[0]) return;
      event.stopImmediatePropagation(); connect(event.ports[0]);
    });
  } else {
    const NativeWorker = self.Worker;
    self.Worker = class extends NativeWorker {
      constructor(url, options) {
        const target = new URL(url, location.href);
        // WasmPlayer optimizes same-origin pthreads by replacing its stub URL
        // with WebClient.js. Route both forms through our worker prelude.
        const engine = target.origin === location.origin &&
          ['/roblox/engine-worker.js', '/roblox/engine/WebClient.js'].includes(target.pathname);
        super(engine ? new URL('/roblox/engine-worker.js', location.origin).href : url, options);
        if (!engine) return;
        const channel = new MessageChannel();
        channel.port1.onmessage = async ({ data }) => {
          if (data.type === 'velora:roblox-connection') { observeConnection(data); return; }
          if (data.type === 'status') { port?.postMessage(data); return; }
          if (data.type !== 'request') return;
          try {
            const result = await request(data.url, data.init);
            channel.port1.postMessage({ type: 'response', id: data.id, result }, [result.body]);
          } catch (error) { channel.port1.postMessage({ type: 'response', id: data.id, error: error.message }); }
        };
        this.postMessage({ type: 'velora:roblox-worker-connect' }, [channel.port2]);
      }
    };
  }
})();
