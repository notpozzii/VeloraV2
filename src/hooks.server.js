export async function handle({ event, resolve }) {
	const response = await resolve(event);
	if (event.url.pathname === '/roblox' || event.url.pathname.startsWith('/roblox/')) {
		const headers = new Headers(response.headers);
		headers.set('Cross-Origin-Opener-Policy', 'same-origin');
		headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
		headers.set('Cross-Origin-Resource-Policy', 'same-origin');
		// Per-document isolation lets the Roblox frame use shared memory even
		// when the surrounding desktop is not cross-origin isolated.
		headers.set('Document-Isolation-Policy', 'isolate-and-require-corp');
		return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
	}
	return response;
}
