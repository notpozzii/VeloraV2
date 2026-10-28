import { resetInProgress } from '../reset-core.js';

export const developerModeKey = 'velora:developer-mode:v1';
export const activityLimit = 400;
const hubKey = '__veloraDeveloperActivityV1';
const routes = { '/': 'Desktop', '/index.html': 'Desktop', '/os': 'Desktop', '/slate': 'Browser', '/settings': 'Settings', '/apps': 'Apps', '/books': 'Games', '/api': 'App frame', '/download': 'Downloads' };
const events = {
	'enabled': ['system', 'Developer mode enabled'],
	'page-ready': ['system', 'Velora page ready'],
	'online': ['system', 'Browser reports online'],
	'offline': ['system', 'Browser reports offline', 'warn'],
	'worker': ['system', 'Background worker controller changed'],
	'app-open': ['apps', 'App window opened'],
	'app-close': ['apps', 'App window closed'],
	'app-load': ['apps', 'App frame loaded'],
	'app-error': ['errors', 'App frame failed to load', 'error'],
	'navigation': ['apps', 'Browser document loaded'],
	'connection-start': ['connection', 'Preparing connection'],
	'connection-ready': ['connection', 'Connection runtime ready'],
	'connection-reused': ['connection', 'Reusing prepared connection'],
	'connection-failed': ['connection', 'Connection setup failed', 'error'],
	'attempt': ['connection', 'Opening page with connection'],
	'attempt-ready': ['connection', 'Page navigation started'],
	'attempt-failed': ['connection', 'Page connection failed', 'warn'],
	'cancelled': ['connection', 'Page navigation cancelled'],
	'resource': ['network', 'Resource finished'],
	'resource-error': ['errors', 'Resource failed to load', 'error'],
	'error': ['errors', 'JavaScript error', 'error'],
	'rejection': ['errors', 'Unhandled promise rejection', 'error'],
	'console': ['console', 'Console call']
};
const allowed = (value, list) => list.includes(value) ? value : undefined;
const number = (value, max = 1e12) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(Math.min(value, max)) : undefined;

// Record domains and known Velora routes, never query strings, encoded proxy
// paths, credentials, or arbitrary page paths that may contain private data.
export function activityTarget(value, base = 'https://velora.invalid') {
	try {
		const url = new URL(value, base);
		if (!['https:', 'http:', 'ws:', 'wss:'].includes(url.protocol)) return undefined;
		if (url.origin === new URL(base).origin && routes[url.pathname]) return routes[url.pathname];
		return `${url.protocol}//${url.host}`;
	} catch { return undefined; }
}
export function activityReason(error) {
	try {
		if (error?.name === 'AbortError') return 'Cancelled';
		if (error?.name === 'TimeoutError' || /timed?\s*out|timeout/i.test(error?.message || '')) return 'Timed out';
		if (error?.name === 'SecurityError' || /permission|denied|blocked/i.test(error?.message || '')) return 'Access restricted';
		if (/network|fetch|connect|socket|offline/i.test(error?.message || '')) return 'Network error';
	} catch {}
	return 'Unknown error';
}
function safeDetails(input, base) {
	const detail = {};
	const strings = {
		engine: ['sj2', 'sj', 'uv', 'auto'],
		transport: ['libcurl', 'libcurlRaw', 'epoxy', 'auto'],
		reason: ['Cancelled', 'Timed out', 'Access restricted', 'Network error', 'Unknown error'],
		method: ['log', 'info', 'debug', 'warn', 'error'],
		kind: ['fetch', 'xmlhttprequest', 'script', 'css', 'img', 'iframe', 'link', 'video', 'audio', 'other'],
		errorClass: ['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'URIError', 'EvalError', 'SecurityError', 'AbortError', 'TimeoutError']
	};
	for (const [key, values] of Object.entries(strings)) {
		const value = allowed(input[key], values);
		if (value) detail[key] = value;
	}
	for (const key of ['duration', 'bytes', 'attempt', 'total', 'line', 'column', 'arguments']) {
		const value = number(input[key]);
		if (value !== undefined) detail[key] = value;
	}
	if (typeof input.status === 'number' && input.status >= 100 && input.status <= 599) detail.status = Math.round(input.status);
	const target = activityTarget(input.target, base);
	if (typeof input.target === 'string' && target) detail.target = target;
	return Object.freeze(detail);
}

export function createActivityHub({ now = Date.now, limit = activityLimit } = {}) {
	limit = Math.max(1, Math.min(activityLimit, Number(limit) || activityLimit));
	let enabled = false, paused = false, open = false, entries = [], dropped = 0, sequence = 0;
	const listeners = new Set();
	const snapshot = () => Object.freeze({ enabled, paused, open, entries: Object.freeze([...entries]), dropped });
	function emit() { for (const listener of [...listeners]) { try { listener(snapshot()); } catch {} } }
	const hub = {
		snapshot,
		subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
		setEnabled(value) {
			if (enabled === !!value) return;
			enabled = !!value; paused = false; open = enabled; entries = []; dropped = 0;
			if (enabled) hub.record('enabled');
			else emit();
		},
		setOpen(value) { open = enabled && !!value; emit(); },
		setPaused(value) { paused = enabled && !!value; emit(); },
		clear() { entries = []; dropped = 0; emit(); },
		record(code, input = {}, context = {}) {
			if (!enabled || paused || !Object.hasOwn(events, code)) return;
			const [category, message, level = 'info'] = events[code];
			const details = safeDetails(input, context.base);
			const severity = code === 'console' ? (details.method === 'error' ? 'error' : details.method === 'warn' ? 'warn' : 'info') : code === 'resource' && details.status >= 400 ? 'warn' : level;
			const source = routes[context.path] || 'Velora';
			const entry = Object.freeze({ id: ++sequence, time: now(), category, message, severity, source, details });
			entries.push(entry);
			if (entries.length > limit) { dropped += entries.length - limit; entries.splice(0, entries.length - limit); }
			emit();
			return entry;
		}
	};
	return hub;
}

export function activityOwner(host) {
	let owner = host, target = host;
	try {
		while (target.parent && target.parent !== target) {
			target = target.parent;
			if (target.document.querySelector?.('[data-velora-site]')) owner = target;
		}
	} catch { /* Stop at cross-origin embedding boundaries. */ }
	return owner;
}
export function getActivityHub(host = globalThis.window) {
	if (!host) return null;
	// About:blank/blob wrappers have no console UI of their own. Keep ownership
	// on the outermost actual Velora document, including inside those wrappers.
	const owner = activityOwner(host);
	if (!owner[hubKey]) {
		const hub = createActivityHub();
		owner[hubKey] = hub;
		try { hub.setEnabled(owner.localStorage.getItem(developerModeKey) === 'true'); } catch {}
	}
	return owner[hubKey];
}
export function recordActivity(code, details, host = globalThis.window) {
	try {
		if (!host || resetInProgress(host)) return;
		return getActivityHub(host)?.record(code, details, { base: host.location.origin, path: host.location.pathname });
	} catch { /* Diagnostics must never interrupt navigation or media. */ }
}
export function setDeveloperMode(enabled, host = globalThis.window) {
	if (!host || resetInProgress(host)) return false;
	let saved = true;
	try { host.localStorage.setItem(developerModeKey, String(!!enabled)); } catch { saved = false; }
	getActivityHub(host).setEnabled(enabled);
	return saved;
}

// Observe only this app document. Never inject instrumentation into third-party
// proxy documents, patch network APIs, or read console arguments / request bodies.
export function installActivityCollector(host) {
	const hub = getActivityHub(host);
	const cleanup = [];
	let capturing = false;
	const record = (code, details) => recordActivity(code, details, host);
	function listen(target, name, callback, options) {
		target?.addEventListener(name, callback, options);
		cleanup.push(() => target?.removeEventListener(name, callback, options));
	}
	function stop() { capturing = false; for (const dispose of cleanup.splice(0)) { try { dispose(); } catch {} } }
	function start() {
		capturing = true;
		listen(host, 'online', () => record('online'));
		listen(host, 'offline', () => record('offline'));
		listen(host.navigator?.serviceWorker, 'controllerchange', () => record('worker'));
		listen(host, 'error', event => {
			if (event.target && event.target !== host) {
				record('resource-error', { target: event.target.src || event.target.href });
			} else record('error', { errorClass: event.error?.name, reason: activityReason(event.error), target: event.filename, line: event.lineno, column: event.colno });
		}, true);
		listen(host, 'unhandledrejection', event => record('rejection', { errorClass: event.reason?.name, reason: activityReason(event.reason) }));
		try {
			const observer = new host.PerformanceObserver(list => {
				for (const entry of list.getEntries()) record('resource', { target: entry.name, kind: entry.initiatorType, duration: entry.duration, bytes: entry.transferSize, status: entry.responseStatus });
			});
			observer.observe({ type: 'resource', buffered: false });
			cleanup.push(() => observer.disconnect());
		} catch { /* Resource timing is optional in older browsers. */ }
		for (const method of ['log', 'info', 'debug', 'warn', 'error']) {
			const original = host.console?.[method];
			if (typeof original !== 'function') continue;
			const wrapper = function (...args) {
				const result = Reflect.apply(original, host.console, args);
				record('console', { method, arguments: args.length });
				return result;
			};
			try {
				host.console[method] = wrapper;
				cleanup.push(() => { if (host.console[method] === wrapper) host.console[method] = original; });
			} catch {}
		}
		record('page-ready');
	}
	let unsubscribe;
	let disposed = false;
	function resume() {
		if (disposed || unsubscribe) return;
		unsubscribe = hub.subscribe(state => { if (state.enabled && !capturing) start(); else if (!state.enabled && capturing) stop(); });
	}
	function suspend() { unsubscribe?.(); unsubscribe = undefined; stop(); }
	// A parent hub must not retain closed iframe realms through subscriptions.
	// Restore collection if the browser revives this document from its page cache.
	resume();
	host.addEventListener('pagehide', suspend);
	host.addEventListener('pageshow', resume);
	const onStorage = event => {
		if (event.key === developerModeKey || event.key === null) {
			let enabled = false;
			try { enabled = host.localStorage.getItem(developerModeKey) === 'true'; } catch {}
			hub.setEnabled(enabled);
		}
	};
	host.addEventListener('storage', onStorage);
	return () => { disposed = true; suspend(); host.removeEventListener('storage', onStorage); host.removeEventListener('pagehide', suspend); host.removeEventListener('pageshow', resume); };
}
