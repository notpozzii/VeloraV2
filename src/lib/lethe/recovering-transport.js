function endedMux(error) {
	return /MuxTaskEnded|Multiplexor task ended/i.test(String(error?.message ?? error));
}

// A dead Wisp multiplexer cannot serve later tabs. Rebuild it once for a safe
// read, coalescing simultaneous failures rather than reconnecting per asset.
export function createRecoveringTransport(create) {
	let active;
	let starting;
	async function current() {
		if (active) return active;
		if (!starting) {
			starting = (async () => {
				const transport = create();
				await transport.init();
				active = transport;
				return transport;
			})().finally(() => { starting = null; });
		}
		return starting;
	}
	function invalidate(transport) {
		if (active === transport) active = null;
	}
	return {
		get ready() { return !!active?.ready; },
		get client_version() { return active?.client_version; },
		init: current,
		async meta(...args) { return (await current()).meta(...args); },
		async request(remote, method, body, headers, signal) {
			const transport = await current();
			try {
				return await transport.request(remote, method, body, headers, signal);
			} catch (error) {
				if (!endedMux(error)) throw error;
				invalidate(transport);
				if (signal?.aborted || body != null || !['GET', 'HEAD'].includes(method.toUpperCase())) throw error;
				const replacement = await current();
				try {
					return await replacement.request(remote, method, body, headers, signal);
				} catch (retryError) {
					if (endedMux(retryError)) invalidate(replacement);
					throw retryError;
				}
			}
		},
		connect(...args) {
			// WebSocket sessions are not replayable. Preserve the original handles.
			if (!active) throw new Error('Relay disconnected. Reload the page to reconnect.');
			return active.connect(...args);
		}
	};
}
