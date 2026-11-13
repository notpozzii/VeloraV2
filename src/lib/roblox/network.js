const API_HOST = /(^|\.)roblox\.com$/;
const ASSET_HOST = /(^|\.)rbxcdn\.com$/;
const NATIVE_JOIN = /^\/v1\/(join-game|join-game-instance|join-private-game|join-reserved-game)$/;
const DROP_HEADERS = new Set(['host', 'connection', 'content-length', 'accept-encoding', 'cookie', 'authorization']);

export function parsePlace(value) {
	const text = String(value).trim();
	let id = /^\d+$/.test(text) ? text : '';
	if (!id) {
		try {
			const url = new URL(text);
			if (url.protocol !== 'https:' || !API_HOST.test(url.hostname)) return null;
			id = url.pathname.match(/^\/games\/(\d+)(?:\/|$)/)?.[1] || '';
		} catch { return null; }
	}
	const number = Number(id);
	return Number.isSafeInteger(number) && number > 0 ? String(number) : null;
}

export function allowedRobloxUrl(value) {
	const url = new URL(value);
	if (url.protocol !== 'https:' || url.username || url.password || url.port ||
		(!API_HOST.test(url.hostname) && !ASSET_HOST.test(url.hostname))) throw new Error('The client requested an unsupported server.');
	return url;
}

// Native join replies carry the same routing fields the browser endpoint needs.
// Only derive an address from a successful, authenticated reply; never invent a
// ticket or change a server denial into success.
export function gameAddress(script) {
	const edge = script?.UdmuxEndpoints?.[0];
	const port = Number(script?.NetStackPort);
	let token = String(script?.NetStackTokenValue || '');
	if (!edge || !Number.isInteger(port) || port < 1 || port > 65535) return null;
	if (!/^[\da-f]{32}$/i.test(token)) {
		try { token = Array.from(atob(token), c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''); }
		catch { return null; }
	}
	if (!/^[\da-f]{32}$/i.test(token)) return null;
	const ip = value => {
		const parts = String(value || '').split('.');
		return parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255) ? parts.map(Number) : null;
	};
	const machine = ip(script.MachineAddress), address = ip(edge.Address);
	if (!machine || !address || address[3] === 255) return null;
	address[3]++;
	const hex = parts => parts.map(p => p.toString(16).padStart(2, '0')).join('');
	return `${token.toLowerCase()}-${hex(machine)}-${port.toString(16)}.${hex(address)}.qdmux.roblox.com`;
}

export function createRobloxNetwork(controller, onEvent = () => {}) {
	let csrf = '';
	const pending = new Set();
	let disposed = false;
	async function saveResponseCookies(raw, url) {
		// Read the transport's raw pairs: browsers may hide Set-Cookie on their
		// Headers API, and Roblox can rotate a session during authenticated calls.
		const pairs = raw && typeof raw[Symbol.iterator] === 'function' ? Array.from(raw) : Object.entries(raw || {});
		let changed = false;
		for (const [name, value] of pairs) {
			if (name.toLowerCase() !== 'set-cookie') continue;
			for (const cookie of Array.isArray(value) ? value : [value]) controller.cookieJar.setCookies(cookie, url);
			changed = true;
		}
		if (changed) await controller.persistCookies();
	}
	async function request(value, init = {}, redirects = 0) {
		if (disposed) throw new Error('The Roblox connection has closed.');
		const url = allowedRobloxUrl(value);
		const method = String(init.method || 'GET').toUpperCase();
		if (!['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) throw new Error('Unsupported request method.');
		await controller.loadSavedCookies(true);
		const headers = {};
		for (const [name, val] of new Headers(init.headers || {})) if (!DROP_HEADERS.has(name.toLowerCase())) headers[name.toLowerCase()] = val;
		const cookie = controller.cookieJar.getCookies(url, false);
		if (cookie) headers.cookie = cookie;
		headers.origin = 'https://play.roblox.com';
		headers.referer = 'https://play.roblox.com/';
		const isJoin = url.hostname === 'gamejoin.roblox.com' && NATIVE_JOIN.test(url.pathname);
		if (isJoin) {
			let fields = [];
			try { fields = Object.keys(JSON.parse(typeof init.body === 'string' ? init.body : new TextDecoder().decode(init.body))).sort(); } catch {}
			onEvent({ type: 'join-request', path: url.pathname, fields });
			headers['user-agent'] = 'Roblox/WinInet';
			// GameJoin reads Roblox's own identity header independently of the
			// conventional HTTP User-Agent. Replace it once, without duplicates.
			headers['rbx-user-agent'] = 'Roblox/Darwin';
			headers.requester = 'Client';
		}
		if (csrf && method !== 'GET' && method !== 'HEAD') headers['x-csrf-token'] = csrf;
		const abort = new AbortController();
		pending.add(abort);
		const timer = setTimeout(() => abort.abort(), 45000);
		try {
			let res = await controller.transport.request(url, method, init.body ?? null, Object.entries(headers), abort.signal);
			await saveResponseCookies(res.headers, url);
			let responseHeaders = new Headers(res.headers);
			const refreshed = responseHeaders.get('x-csrf-token');
			if (res.status === 403 && refreshed && method !== 'GET' && method !== 'HEAD') {
				csrf = refreshed;
				headers['x-csrf-token'] = csrf;
				const updatedCookie = controller.cookieJar.getCookies(url, false);
				if (updatedCookie) headers.cookie = updatedCookie;
				else delete headers.cookie;
				await res.body?.cancel?.().catch(() => {});
				res = await controller.transport.request(url, method, init.body ?? null, Object.entries(headers), abort.signal);
				await saveResponseCookies(res.headers, url);
				responseHeaders = new Headers(res.headers);
			}
			const location = responseHeaders.get('location');
			if ([301, 302, 303, 307, 308].includes(res.status) && location) {
				if (redirects >= 5) throw new Error('Roblox redirected too many times.');
				const next = allowedRobloxUrl(new URL(location, url).href);
				const get = res.status === 303 || ([301, 302].includes(res.status) && method === 'POST');
				return request(next.href, { ...init, method: get ? 'GET' : method, body: get ? null : init.body }, redirects + 1);
			}
			let body = res.body == null ? new ArrayBuffer(0) : await new Response(res.body).arrayBuffer();
			if (res.status >= 400) onEvent({ type: 'http-error', status: res.status, host: url.hostname, path: url.pathname });
			if (isJoin) {
				let reply;
				try { reply = JSON.parse(new TextDecoder().decode(body)); } catch {}
				onEvent({ type: 'join', status: res.status, result: reply?.status, hasScript: !!reply?.joinScript });
				if (res.status === 200 && reply?.joinScript && !reply.joinScript.gameFqdn) {
					const fqdn = gameAddress(reply.joinScript);
					if (fqdn) {
						reply.joinScript.gameFqdn = fqdn;
						body = new TextEncoder().encode(JSON.stringify(reply)).buffer;
					}
				}
			}
			for (const key of ['set-cookie', 'content-encoding', 'content-length', 'transfer-encoding', 'connection']) responseHeaders.delete(key);
			return { status: res.status, statusText: res.statusText || '', headers: Array.from(responseHeaders), body, url: url.href };
		} finally { clearTimeout(timer); pending.delete(abort); }
	}
	return {
		request,
		async user() {
			const response = await request('https://users.roblox.com/v1/users/authenticated');
			if (response.status === 401) return null;
			if (response.status !== 200) throw new Error(`Roblox sign-in check failed (${response.status}).`);
			const user = JSON.parse(new TextDecoder().decode(response.body));
			return typeof user.id === 'number' && typeof user.name === 'string' ? { id: user.id, name: user.name } : null;
		},
		dispose() { disposed = true; for (const abort of pending) abort.abort(); pending.clear(); }
	};
}
