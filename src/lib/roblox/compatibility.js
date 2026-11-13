// Check the APIs the pinned engine actually uses. Safari 27 includes JSPI;
// a browser name or a Chromium user agent is not a playback requirement.
export function robloxPlaybackSupport(host = globalThis) {
	const agent = host.navigator?.userAgent || '';
	const safari = /Safari\//.test(agent) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/.test(agent);
	const missing = [];
	if (host.isSecureContext === false) missing.push('secure-context');
	if (!host.crossOriginIsolated || typeof host.SharedArrayBuffer !== 'function') missing.push('shared-memory');
	if (typeof host.WebTransport !== 'function') missing.push('webtransport');
	if (typeof host.WebAssembly?.Suspending !== 'function' || typeof host.WebAssembly?.promising !== 'function') missing.push('wasm-jspi');
	let message = '';
	if (missing.includes('secure-context')) {
		message = 'Open Velblox using its HTTPS link to play Roblox.';
	} else if (missing.includes('wasm-jspi') || missing.includes('webtransport')) {
		message = safari
			? 'This Safari version is missing features needed by the Roblox engine. Update to Safari 27 or newer, then reopen Velblox. You can still browse and sign in here.'
			: 'This browser is missing features needed by the Roblox engine. Update your browser, then reopen Velblox. You can still browse and sign in here.';
	} else if (missing.includes('shared-memory')) {
		message = 'Open Velblox directly in its own browser tab and reload to enable Roblox’s shared memory.';
	}
	return { supported: missing.length === 0, missing, message };
}
