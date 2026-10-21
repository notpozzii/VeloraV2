import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const mime = {
	'.js': 'application/javascript', '.mjs': 'application/javascript',
	'.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json',
	'.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png',
	'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
	'.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf'
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Package the app code once; keep large wallpapers available on demand. */
export function addBootstrap(output, routes) {
	const originalShell = readFileSync(join(output, 'index.html'));
	writeFileSync(join(output, 'velora-app.html'), originalShell);
	const assets = {};
	const bodies = [];
	const entries = [];
	let offset = 0;
	for (const file of readdirSync(output, { recursive: true }).sort()) {
		const path = join(output, file);
		if (!statSync(path).isFile() || file === 'servy.js') continue;
		// App routes are bootstrap documents. The shared app shell is packaged once.
		if (file.endsWith('.html') && file !== 'velora-app.html' && !file.includes('/')) continue;
		const type = mime[extname(file)];
		if (!type) continue;
		const bytes = readFileSync(path);
		const url = `/${file}`;
		assets[url] = { type, hash: hash(bytes) };
		const media = /\.(png|jpe?g|webp)$/i.test(file);
		if (media && bytes.length > 256 * 1024 && !/\/default\./.test(url)) continue;
		entries.push({ path: url, type, start: offset, size: bytes.length });
		bodies.push(bytes);
		offset += bytes.length;
	}
	const index = Buffer.from(JSON.stringify(entries));
	const length = Buffer.alloc(4);
	length.writeUInt32BE(index.length);
	const compressed = gzipSync(Buffer.concat([length, index, ...bodies]), { level: 9 });
	const runtime = readFileSync(new URL('./s3-bootstrap/worker.js', import.meta.url));
	const version = hash(Buffer.concat([compressed, Buffer.from(JSON.stringify(assets)), runtime])).slice(0, 20);
	const release = {
		schema: 1, version, bundle: `/velora-bundle.${version}.gz`, sha256: hash(compressed),
		compressedBytes: compressed.length, installedBytes: offset, assets,
		entry: '/velora-app.html',
		routes: [...new Set(['/', '/index.html', '/index.htm', ...routes, ...routes.filter(p => p !== '/').map(p => `${p}.html`)])]
	};
	writeFileSync(join(output, release.bundle.slice(1)), compressed);
	writeFileSync(join(output, 'velora-release.json'), JSON.stringify(release));
	writeFileSync(join(output, 'velora-bootstrap.js'), readFileSync(new URL('./s3-bootstrap/bootstrap.js', import.meta.url)));
	writeFileSync(join(output, 'velora-static-worker.js'), runtime);
	const bootstrap = readFileSync(new URL('./s3-bootstrap/index.html', import.meta.url));
	writeFileSync(join(output, 'index.html'), bootstrap);
	writeFileSync(join(output, 'index.htm'), bootstrap);
	for (const route of routes.filter(p => p !== '/')) {
		const filename = join(output, `${route.slice(1)}.html`);
		// Preserve standalone pages such as /test.html.
		if (readFileSync(filename).equals(originalShell)) writeFileSync(filename, bootstrap);
	}
	const originalWorker = readFileSync(join(output, 'servy.js'), 'utf8');
	const marker = 'self.addEventListener("fetch", (event) => {';
	if (!originalWorker.includes(marker)) throw new Error('Proxy worker fetch handler changed; cannot attach static cache safely.');
	const imports = originalWorker.replace(/importScripts\("([^"]+)"\);/g,
		(_, url) => `importScripts(${JSON.stringify(`${url}?v=${version}`)});`);
	writeFileSync(join(output, 'servy.js'),
		`// S3 static cache release ${version}\nself.VELORA_STATIC_ROUTES = ${JSON.stringify(release.routes)};\nself.VELORA_STATIC_ASSETS = ${JSON.stringify(Object.keys(assets))};\nimportScripts('/velora-static-worker.js?v=${version}');\n` +
		imports.replace(marker, `${marker}\n  const local = self.veloraStaticRequest(event);\n  if (local) { event.respondWith(local); return; }`));
	return release;
}
