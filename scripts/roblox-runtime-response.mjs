// These small engine wrappers must run through the Worker: Sites serves ordinary
// static files before Worker code and does not apply our required isolation.
export function robloxRuntimeResponse(request, files) {
	const path = new URL(request.url).pathname;
	const file = path.startsWith('/roblox/') ? path.slice('/roblox/'.length) : '';
	if (!Object.hasOwn(files, file)) return null;
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
	}
	return new Response(request.method === 'HEAD' ? null : files[file], {
		headers: {
			'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
			'Cache-Control': 'no-store',
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp',
			'Cross-Origin-Resource-Policy': 'same-origin',
			'Document-Isolation-Policy': 'isolate-and-require-corp'
		}
	});
}
