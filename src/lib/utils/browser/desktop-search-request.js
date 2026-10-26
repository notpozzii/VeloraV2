// Confirm that an existing Browser received the request before reusing its window.
export function requestBrowserSearch(
	target,
	query,
	{ host = globalThis.window, timeout = 500 } = {}
) {
	const value = typeof query === 'string' ? query.trim() : '';
	if (!value || !target || !host) return Promise.resolve(false);
	const origin = host.location.origin;
	const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
	return new Promise((resolve) => {
		let settled = false;
		const finish = (accepted) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			host.removeEventListener('message', receive);
			resolve(accepted);
		};
		const receive = (event) => {
			if (event.source !== target || event.origin !== origin) return;
			if (
				event.data?.type !== 'velora:browser-search-accepted' ||
				event.data.requestId !== requestId
			)
				return;
			finish(true);
		};
		const timer = setTimeout(() => finish(false), timeout);
		host.addEventListener('message', receive);
		try {
			target.postMessage({ type: 'velora:browser-search', query: value, requestId }, origin);
		} catch {
			finish(false);
		}
	});
}
