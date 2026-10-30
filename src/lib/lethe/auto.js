import { recordActivity, activityReason } from '../utils/developer/diagnostics.js';
const engineName = (value) => ['uv', 'glass'].includes(value) ? 'uv' : ['sj', 'polygon'].includes(value) ? 'sj' : 'sj2';
export const isAutoConnection = (engine, transport) => engine === 'auto' || transport === 'auto';

export function connectionCandidates(engine = 'auto', transport = 'auto', url = '', remembered) {
	let host = '';
	try { host = new URL(url).hostname; } catch {}
	const geforce = host === 'geforcenow.com' || host.endsWith('.geforcenow.com') || host === 'nvidia.com' || host.endsWith('.nvidia.com');
	const engines = engine === 'auto' ? (geforce ? ['uv', 'sj2', 'sj'] : ['sj2', 'uv', 'sj']) : [engineName(engine)];
	// GeForce's verified Libcurl route omits optional request-filter plugins.
	const transports = transport === 'auto' ? [geforce ? 'libcurlRaw' : 'libcurl', 'epoxy'] : [ ['libcurl', 'libcurlRaw', 'epoxy'].includes(transport) ? transport : 'libcurl' ];
	const candidates = engines.flatMap(engine => transports.map(car => ({ engine, car })));
	// Known media profiles take priority over a merely successful document load.
	const media = geforce || host === 'tiktok.com' || host.endsWith('.tiktok.com');
	const index = !media && remembered ? candidates.findIndex(x => x.engine === remembered.engine && x.car === remembered.car) : -1;
	if (index > 0) candidates.unshift(...candidates.splice(index, 1));
	return candidates;
}

export function autoLauncherUrl(url, engine, transport, wisp = '') {
	return `/api?${new URLSearchParams({ url, type: engine || 'sj2', transport: transport || 'libcurl', ...(wisp ? { wisp } : {}) })}`;
}

function checkAbort(signal) {
	if (signal?.aborted) throw new DOMException('Navigation cancelled', 'AbortError');
}

export function createAutoNavigator({ prepare, storage, now = Date.now } = {}) {
	const key = 'velora:auto-connections:v1';
	function read() {
		try {
			const value = JSON.parse((storage ?? globalThis.sessionStorage)?.getItem(key) || '{}');
			return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
		} catch { return {}; }
	}
	function forget(cacheKey, failed) {
		try {
			const entries = read();
			const current = entries[cacheKey];
			// A second navigation may already have saved a newer working choice.
			if (!current || current.engine !== failed.engine || current.car !== failed.car || current.time !== failed.time) return;
			delete entries[cacheKey];
			(storage ?? globalThis.sessionStorage)?.setItem(key, JSON.stringify(entries));
		} catch {}
	}
	return {
		async open({ url, engine, car, wisp, signal, load, onattempt }) {
			const automatic = isAutoConnection(engine, car);
			const cacheKey = JSON.stringify([new URL(url).origin, wisp || '']);
			const saved = read()[cacheKey];
			const remembered = saved && now() - saved.time < 86400000 ? saved : undefined;
			const candidates = connectionCandidates(engine, car, url, remembered);
			const failures = [];
			for (const [index, candidate] of candidates.entries()) {
				checkAbort(signal);
				const started = now();
				const activity = { engine: candidate.engine, transport: candidate.car, target: url, attempt: index + 1, total: candidates.length };
				recordActivity('attempt', activity);
				onattempt?.({ ...candidate, attempt: index + 1, total: candidates.length });
				try {
					const session = await prepare(candidate.engine, candidate.car, wisp);
					checkAbort(signal);
					await load(session, candidate, signal);
					checkAbort(signal);
					if (automatic) {
						try {
							const entries = Object.entries(read()).filter(([, x]) => x && now() - x.time < 86400000).slice(-29);
							(storage ?? globalThis.sessionStorage)?.setItem(key, JSON.stringify({ ...Object.fromEntries(entries), [cacheKey]: { ...candidate, time: now() } }));
						} catch {}
					}
					recordActivity('attempt-ready', { ...activity, duration: now() - started });
					return { ...session, car: candidate.car };
				} catch (error) {
					recordActivity(signal?.aborted || error?.name === 'AbortError' ? 'cancelled' : 'attempt-failed', { ...activity, duration: now() - started, reason: activityReason(error) });
					checkAbort(signal);
					if (error?.name === 'AbortError') throw error;
					if (!automatic) throw error;
					if (remembered && remembered.engine === candidate.engine && remembered.car === candidate.car) forget(cacheKey, remembered);
					failures.push(error);
				}
			}
			throw new AggregateError(failures, 'Auto could not open this page with any available connection. Check your relay or choose a connection manually.');
		}
	};
}

function proxyDocumentFailure(doc, text) {
	// SJ2 returns a plain-text 500 on transport errors, including Epoxy's TLS
	// handshake EOF. It has no error-page title, so title checks alone miss it.
	if (/^Internal Service Worker Error:\s*\S/i.test(text)) return 'The proxy connection failed.';
	if (/^The browser connection expired\.|^The browser connection could not be restored\./.test(text)) return 'Proxy connection expired.';
	const title = (doc.title || '').trim();
	if (/^(Ultraviolet|Scramjet) Error$/i.test(title)) return 'The proxy could not load this page.';
	// Recognize the error templates actually shipped by UV and legacy SJ. A
	// normal website titled "Error" or returning 403/404/500 is not a failed
	// connection. Check their distinctive diagnostic elements together.
	const has = selector => !!doc.querySelector?.(selector);
	if (has('textarea#errorTrace') && has('#fetchedURL') && (
		(/^Error$/i.test(title) && has('#uvVersion')) ||
		(/^Scramjet$/i.test(title) && has('#version-wrapper'))
	)) return 'The proxy could not load this page.';
	return null;
}

// Watch only the initial GET navigation. Stop as soon as its document loads;
// never retry a form, sign-in submission, video session, or later in-page action.
export function waitForProxyDocument(frame, navigate, { signal, timeoutMs = 12000 } = {}) {
	checkAbort(signal);
	const previous = frame.contentDocument;
	return new Promise((resolve, reject) => {
		let done = false;
		const finish = (error) => {
			if (done) return;
			done = true;
			clearTimeout(timeout); clearInterval(poll);
			frame.removeEventListener('load', inspect);
			frame.removeEventListener('error', fail);
			signal?.removeEventListener('abort', abort);
			error ? reject(error) : resolve();
		};
		function inspect() {
			try {
				const doc = frame.contentDocument;
				if (!doc || doc === previous || doc.URL === 'about:blank' || /\/proxy-frame(?:\.html)?[?]/.test(doc.URL)) return;
				if (doc.readyState === 'loading' || !doc.body?.childNodes.length) return;
				const text = doc.body.textContent.trim();
				const failure = proxyDocumentFailure(doc, text);
				if (failure) return finish(new Error(failure));
				if (!(doc.body.innerText ?? text).trim() && !doc.body.querySelector?.('img, video, canvas, svg, input, button, iframe, [role="application"]')) return;
				finish();
			} catch { /* Keep waiting; an unreadable frame is not proof of failure. */ }
		}
		const fail = () => finish(new Error('The page connection failed.'));
		const abort = () => finish(new DOMException('Navigation cancelled', 'AbortError'));
		const timeout = setTimeout(() => finish(new Error('The page did not start loading in time.')), timeoutMs);
		const poll = setInterval(inspect, 250);
		frame.addEventListener('load', inspect);
		frame.addEventListener('error', fail);
		signal?.addEventListener('abort', abort, { once: true });
		Promise.resolve().then(() => {
			checkAbort(signal);
			if (!done) return navigate();
		}).then(inspect, finish);
	});
}
