import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

const root = resolve('build/s3/site');
const manifest = JSON.parse(readFileSync('build/s3/manifest.json', 'utf8'));
const routes = new Set(manifest.routes);
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
	'.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json',
	'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
	'.webp': 'image/webp', '.woff2': 'font/woff2', '.gz': 'application/octet-stream' };
createServer((req, res) => {
	let pathname;
	try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
	catch { res.writeHead(400).end(); return; }
	const object = routes.has(pathname) ? '/index.html' : pathname;
	const path = resolve(root, `.${object}`);
	if (!path.startsWith(root + sep) || !existsSync(path) || !statSync(path).isFile()) {
		res.writeHead(404).end('Object not found'); return;
	}
	res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
	if (req.method === 'HEAD') res.end();
	else createReadStream(path).pipe(res);
}).listen(5197, '127.0.0.1', () => console.log('S3 object preview: http://localhost:5197/index.html'));
