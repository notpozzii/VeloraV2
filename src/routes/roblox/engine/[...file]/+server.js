import { ROBLOX_BUILD } from '$lib/roblox/build.js';

export async function GET({ params, fetch }) {
	const path = params.file;
	if (!path || path.length > 500 || !/^[\w./ @-]+$/.test(path) || path.split('/').some(p => p === '..' || p === '.')) {
		return new Response('Invalid engine asset', { status: 400 });
	}
	const upstream = await fetch(`https://setup.rbxcdn.com/webclient/${ROBLOX_BUILD.upload}/${path}`, {
		credentials: 'omit', redirect: 'manual'
	});
	// Edge fetch supports manual redirects, but not redirect: 'error'. Keep the
	// pinned CDN boundary: never follow a redirect to another source.
	if (upstream.status >= 300 && upstream.status < 400) {
		await upstream.body?.cancel();
		return new Response('The pinned engine asset moved unexpectedly.', { status: 502 });
	}
	const headers = new Headers();
	for (const key of ['Content-Type', 'ETag', 'Last-Modified']) {
		if (upstream.headers.has(key)) headers.set(key, upstream.headers.get(key));
	}
	headers.set('Cache-Control', upstream.ok ? 'public, max-age=86400' : 'no-store');
	headers.set('Cross-Origin-Resource-Policy', 'same-origin');
	return new Response(upstream.body, { status: upstream.status, headers });
}
