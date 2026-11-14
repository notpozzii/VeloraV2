export async function GET({ params, fetch, platform, url }) {
	if (!['index.html', 'velora.svg'].includes(params.file)) return new Response('File not found', { status: 404 });
	const built = platform?.env?.ASSETS
		? await platform.env.ASSETS.fetch(new URL(`/portable/${params.file}`, url.origin))
		: await fetch(`/portable/${params.file}`);
	if (!built.ok) return new Response('The desktop download is temporarily unavailable.', { status: 503 });
	const content = built.body;
	const type = params.file === 'index.html' ? 'text/html' : 'image/svg+xml';
	return new Response(content, {
		headers: {
			'Content-Type': `${type}; charset=utf-8`,
			'Content-Disposition': `attachment; filename="${params.file}"`,
			'Cache-Control': 'no-cache',
			'X-Content-Type-Options': 'nosniff'
		}
	});
}
