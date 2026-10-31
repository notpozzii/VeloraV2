import svg from '$lib/downloads/velora.svg?raw';

export async function GET({ params, fetch, platform, url }) {
	let content, type;
	if (params.file === 'index.html') {
		const built = platform?.env?.ASSETS
			? await platform.env.ASSETS.fetch(new URL('/portable/index.html', url.origin))
			: await fetch('/portable/index.html');
		if (!built.ok) return new Response('The desktop download is temporarily unavailable.', { status: 503 });
		content = built.body; type = 'text/html';
	} else if (params.file === 'velora.svg') {
		content = svg; type = 'image/svg+xml';
	} else return new Response('File not found', { status: 404 });
	return new Response(content, {
		headers: {
			'Content-Type': `${type}; charset=utf-8`,
			'Content-Disposition': `attachment; filename="${params.file}"`,
			'Cache-Control': 'no-cache',
			'X-Content-Type-Options': 'nosniff'
		}
	});
}
