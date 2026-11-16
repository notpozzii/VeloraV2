import { createRecoveringTransport } from './recovering-transport.js';

import { resolveRelays } from './relay-config.js';
export { PRIMARY_WISP, BACKUP_WISP } from './relay-config.js';
const KEY = 'velora:relay-fallback:v3';
const COOLDOWN = 5 * 60 * 1000;
const failures = new Map();
const pairKey = (main, backup) => JSON.stringify([main, backup]);

function readFailures() {
	try {
		const data = JSON.parse(globalThis.sessionStorage?.getItem(KEY) || '{}');
		if (data && typeof data === 'object' && !Array.isArray(data))
			for (const [url, until] of Object.entries(data)) if (Number.isFinite(until) && until > Date.now()) failures.set(url, until);
	} catch {}
}

export function getRelayUrl(custom, backupWisp) {
	const { main, backup } = resolveRelays(custom, backupWisp);
	readFailures();
	return (failures.get(pairKey(main, backup)) || 0) > Date.now() ? backup : main;
}

export function rememberRelayFailure(custom, backupWisp) {
	const { main, backup } = resolveRelays(custom, backupWisp);
	if (main === backup || getRelayUrl(main, backup) === backup) return false;
	failures.set(pairKey(main, backup), Date.now() + COOLDOWN);
	for (const [key, until] of failures) if (until <= Date.now()) failures.delete(key);
	try { globalThis.sessionStorage?.setItem(KEY, JSON.stringify(Object.fromEntries(failures))); } catch {}
	return true;
}

export function relayConnectionError(error) {
	if (error?.name === 'AbortError') return false;
	return error?.name === 'TimeoutError' || /MuxTaskEnded|Multiplexor task ended|Wisp\(|\bwisp\b|websocket|network|failed to fetch|fetch failed|connection (?:failed|closed|refused|reset|timed out)|could(?:n.t| not) connect|timed? ?out|libcurl.*(?:connect|resolve)/i.test(String(error?.message ?? error));
}

// Time out only connection/response headers, never a streaming response body.
async function deadline(run, milliseconds, signal) {
	if (signal?.aborted) throw new DOMException('Navigation cancelled', 'AbortError');
	const controller = new AbortController();
	const nativeAny = typeof AbortSignal.any === 'function';
	const combined = signal && nativeAny ? AbortSignal.any([signal, controller.signal]) : controller.signal;
	const forward = () => controller.abort(signal.reason);
	if (signal && !nativeAny) signal.addEventListener('abort', forward, { once: true });
	let timer;
	let abortHeaders;
	let result;
	try {
		result = await Promise.race([
			run(combined),
			new Promise((_, reject) => {
				abortHeaders = () => reject(combined.reason || new DOMException('Navigation cancelled', 'AbortError'));
				combined.addEventListener('abort', abortHeaders, { once: true });
				if (combined.aborted) abortHeaders();
			}),
			new Promise((_, reject) => {
				timer = setTimeout(() => {
					const error = new DOMException('Relay response timed out.', 'TimeoutError');
					reject(error);
					controller.abort(error);
				}, milliseconds);
			})
		]);
		return result;
	} finally {
		clearTimeout(timer);
		combined.removeEventListener('abort', abortHeaders);
		// Body downloads still need the caller's signal after headers arrive.
		if (!result?.body?.getReader && signal && !nativeAny) signal.removeEventListener('abort', forward);
	}
}

export function createRelayTransport(create, custom, { timeoutMs = 10000, backupWisp } = {}) {
	const { backup } = resolveRelays(custom, backupWisp);
	let selected = getRelayUrl(custom, backup);
	const make = relay => createRecoveringTransport(() => create(relay));
	let active = make(selected);
	function useBackup() {
		if (selected === backup) return false;
		rememberRelayFailure(custom, backup);
		selected = backup;
		active = make(selected);
		return true;
	}
	function syncChoice() {
		// A media error in another frame may have selected the backup already.
		if (selected !== backup && getRelayUrl(custom, backup) === backup) useBackup();
	}
	async function initialize() {
		syncChoice();
		const transport = active;
		try { return await deadline(() => transport.init(), timeoutMs); }
		catch (error) {
			if (!relayConnectionError(error) || !(transport !== active || useBackup())) throw error;
			return deadline(() => active.init(), timeoutMs);
		}
	}
	return {
		get ready() { return active.ready; },
		get client_version() { return active.client_version; },
		get relay() { return selected; },
		init: initialize,
		async meta(...args) { await initialize(); return active.meta(...args); },
		async request(remote, method, body, headers, signal) {
			syncChoice();
			const transport = active;
			const safe = body == null && ['GET', 'HEAD'].includes(String(method).toUpperCase());
			try {
				return safe
					? await deadline(innerSignal => transport.request(remote, method, body, headers, innerSignal), timeoutMs, signal)
					: await transport.request(remote, method, body, headers, signal);
			} catch (error) {
				if (signal?.aborted || !relayConnectionError(error)) throw error;
				const changed = transport !== active || useBackup();
				// Do not replay logins, uploads, or any non-idempotent operation.
				if (!changed || !safe) throw error;
				return deadline(innerSignal => active.request(remote, method, body, headers, innerSignal), timeoutMs, signal);
			}
		},
		connect(...args) {
			// Existing sockets/game sessions keep their handles and aren't replayed.
			return active.connect(...args);
		}
	};
}
