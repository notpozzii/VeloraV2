// S3 cannot serve a fallback document for dynamic proxy URLs. Establish control
// inside a real, same-origin iframe document before its first proxy navigation.
const prepared = new WeakSet();
export function resetProxyFrame(frame) { prepared.delete(frame); }

export function prepareProxyFrame(frame, { signal, timeoutMs = 15000, host = window } = {}) {
	if (signal?.aborted) return Promise.reject(new DOMException('Launch cancelled', 'AbortError'));
	if (prepared.has(frame)) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const request = host.crypto.randomUUID();
		const cleanup = () => {
			clearTimeout(timer);
			host.removeEventListener('message', onMessage);
			signal?.removeEventListener('abort', onAbort);
		};
		const fail = (error) => { cleanup(); reject(error); };
		const onAbort = () => fail(new DOMException('Launch cancelled', 'AbortError'));
		const onMessage = (event) => {
			if (event.origin !== host.location.origin || event.source !== frame.contentWindow) return;
			if (event.data?.type !== 'velora:frame-ready' || event.data.request !== request) return;
			if (event.data.error) return fail(new Error('The app connection could not start. Try again.'));
			cleanup();
			prepared.add(frame);
			resolve();
		};
		const timer = setTimeout(() => fail(new Error('The app connection timed out. Try again.')), timeoutMs);
		host.addEventListener('message', onMessage);
		signal?.addEventListener('abort', onAbort, { once: true });
		frame.src = `/proxy-frame.html?request=${encodeURIComponent(request)}`;
	});
}
