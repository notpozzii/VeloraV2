// Run after export:s3. Requires Playwright and Chromium (or VELORA_BROWSER_PATH).
// VELORA_PLAYWRIGHT_MODULE may point to a preinstalled Playwright package.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

const { chromium } = await import(process.env.VELORA_PLAYWRIGHT_MODULE || 'playwright');
const root = resolve('build/s3/site');
const published = JSON.parse(readFileSync(`${root}/velora-release.json`, 'utf8'));
let release = published;
let corrupt = false;
let unavailable = false;
const requests = [];
const types = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.html': 'text/html',
	'.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
	'.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.otf': 'font/otf' };
const server = createServer((req, res) => {
	const url = new URL(req.url, 'http://localhost');
	requests.push(url.pathname);
	if (url.pathname === '/velora-release.json') {
		res.writeHead(unavailable ? 503 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
		res.end(unavailable ? '{}' : JSON.stringify(release));
		return;
	}
	if (url.pathname === release.bundle) {
		res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
		res.end(corrupt ? Buffer.from('broken download') : readFileSync(`${root}${published.bundle}`));
		return;
	}
	const key = published.routes.includes(url.pathname) ? '/index.html' : url.pathname;
	const path = resolve(root, `.${key}`);
	if (!path.startsWith(root + sep) || !existsSync(path) || !statSync(path).isFile()) {
		res.writeHead(404).end('Not found'); return;
	}
	res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
	createReadStream(path).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ headless: true,
	...(process.env.VELORA_BROWSER_PATH ? { executablePath: process.env.VELORA_BROWSER_PATH } : {}) });
try {
	const context = await browser.newContext();
	const page = await context.newPage();
	const boot = async () => {
		await page.goto(`${origin}/index.html`);
		await page.getByText('Browser mode', { exact: true }).waitFor({ timeout: 30000 });
	};
	const savedVersion = () => page.evaluate(async () =>
		(await (await caches.open('velora-static-control')).match('/__velora_release__')).json().then(r => r.version));
	await boot();
	assert.equal(await savedVersion(), published.version);
	assert.equal(requests.filter(p => p === published.bundle).length, 1);
	assert.equal(requests.filter(p => p.startsWith('/_app/immutable/')).length, 0, 'App code should come from device storage');
	console.log('PASS: first visit downloads once, saves the bundle, and opens the desktop');
	requests.length = 0;
	await boot();
	assert.equal(requests.filter(p => p.includes('velora-bundle.')).length, 0);
	assert.equal(requests.filter(p => p === '/velora-release.json').length, 1);
	console.log('PASS: repeat visit checks the version and reuses cached app code');
	const worker = context.serviceWorkers().find(w => w.url().endsWith('/servy.js'));
	assert.ok(worker);
	assert.equal(await worker.evaluate(() => {
		const paths = ['/prism/session123/encoded-target', '/service/glass/encoded-target', '/scramjet/encoded-target'];
		return paths.every(path => self.veloraStaticRequest({ request: new Request(new URL(path, self.location.href)) }) === null);
	}), true, 'Dynamic proxy routes must bypass the static cache');
	console.log('PASS: UV, SJ, and SJ2 proxy session traffic bypasses the app cache');
	requests.length = 0;
	await page.evaluate(() => {
		const frame = document.createElement('iframe');
		frame.title = 'bootstrap-test';
		frame.src = '/api?url=https%3A%2F%2Fexample.com&autoSW=false';
		document.body.appendChild(frame);
	});
	await page.frameLocator('iframe[title="bootstrap-test"]').getByRole('button', { name: 'Click to load' }).waitFor({ timeout: 20000 });
	assert.equal(requests.filter(p => p === '/velora-release.json' || p.includes('velora-bundle.')).length, 0);
	console.log('PASS: embedded app routes reuse the installed app without extra version checks');
	release = { ...published, version: '11111111111111111111', bundle: '/velora-bundle.11111111111111111111.gz' };
	await boot();
	assert.equal(await savedVersion(), release.version);
	assert.ok((await page.evaluate(() => caches.keys())).includes(`velora-static-${published.version}`));
	console.log('PASS: new releases install automatically and preserve the prior cache for old tabs');
	corrupt = true;
	release = { ...published, version: '22222222222222222222', bundle: '/velora-bundle.22222222222222222222.gz' };
	await boot();
	assert.equal(await savedVersion(), '11111111111111111111');
	assert.ok(!(await page.evaluate(() => caches.keys())).includes('velora-static-22222222222222222222'));
	console.log('PASS: corrupted update keeps the working saved version');
	unavailable = true;
	await boot();
	assert.equal(await savedVersion(), '11111111111111111111');
	console.log('PASS: unavailable update manifest uses the saved app');
	const fresh = await browser.newContext();
	const newPage = await fresh.newPage();
	unavailable = false;
	await newPage.goto(`${origin}/index.html`);
	await newPage.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 20000 });
	assert.match(await newPage.locator('#detail').innerText(), /incomplete/);
	corrupt = false;
	await newPage.getByRole('button', { name: 'Try again' }).click();
	await newPage.getByText('Browser mode', { exact: true }).waitFor({ timeout: 30000 });
	console.log('PASS: failed first install shows a retry and succeeds when the download is fixed');
	await fresh.close();
	await context.close();
} finally {
	await browser.close();
	await new Promise(resolve => server.close(resolve));
}
