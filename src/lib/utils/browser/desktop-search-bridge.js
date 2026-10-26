// Desktop requests can arrive while the browser is still loading its proxy stack.
// Acknowledge receipt immediately, then navigate in order once startup has finished.
export function createBrowserSearchBridge({ host, onSearch, onError }) {
	const pending = [];
	const accepted = new Set();
	const lifetime = new AbortController();
	let ready = false;
	let running = false;
	let destroyed = false;

	async function drain() {
		if (!ready || running || destroyed) return;
		running = true;
		try {
			while (ready && pending.length && !destroyed) {
				const request = pending.shift();
				try {
					await onSearch(request, lifetime.signal);
				} catch (error) {
					if (!destroyed) {
						try { await onError(error, request, lifetime.signal); } catch {}
					}
				}
			}
		} finally {
			running = false;
		}
	}

	function enqueue(query, newTab) {
		if (destroyed || typeof query !== 'string' || !query.trim()) return;
		pending.push({ query: query.trim(), newTab });
		void drain();
	}

	function receive(event) {
		if (destroyed || event.origin !== host.location.origin || event.source !== host.parent) return;
		const data = event.data;
		if (!data || data.type !== 'velora:browser-search' ||
			typeof data.query !== 'string' || !data.query.trim() ||
			typeof data.requestId !== 'string' || !data.requestId.trim()) return;
		try {
			event.source.postMessage({
				type: 'velora:browser-search-accepted', requestId: data.requestId
			}, event.origin);
		} catch {}
		if (accepted.has(data.requestId)) return;
		accepted.add(data.requestId);
		if (accepted.size > 256) accepted.delete(accepted.values().next().value);
		enqueue(data.query, true);
	}

	host.addEventListener('message', receive);
	return {
		enqueueInitialQuery(query) { enqueue(query, false); },
		setReady() {
			ready = true;
			void drain();
		},
		destroy() {
			destroyed = true;
			pending.length = 0;
			accepted.clear();
			lifetime.abort();
			host.removeEventListener('message', receive);
		}
	};
}
