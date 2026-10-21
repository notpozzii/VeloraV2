const CONTROL = 'velora-static-control';
const CURRENT = '/__velora_release__';
const cacheName = version => `velora-static-${version}`;
const status = document.getElementById('status');
const detail = document.getElementById('detail');
const progress = document.getElementById('progress');
const retry = document.getElementById('retry');
const show = (text, fraction) => {
	status.textContent = text;
	if (fraction === undefined) progress.removeAttribute('value');
	else { progress.max = 1; progress.value = fraction; }
};

async function readSaved() {
	const saved = await (await caches.open(CONTROL)).match(CURRENT);
	if (!saved) return null;
	const release = await saved.json();
	return await (await caches.open(cacheName(release.version))).match(release.entry) ? release : null;
}

async function controlPage() {
	const sw = navigator.serviceWorker;
	let timer;
	let cancelled = false;
	let cleanup = () => {};
	try {
		await Promise.race([
			(async () => {
				await sw.register('/servy.js', { updateViaCache: 'imports' });
				await sw.ready;
				if (cancelled || sw.controller?.scriptURL === new URL('/servy.js', location.href).href) return;
				await new Promise(resolve => {
					function changed() {
						if (sw.controller?.scriptURL === new URL('/servy.js', location.href).href) resolve();
					}
					cleanup = () => sw.removeEventListener('controllerchange', changed);
					sw.addEventListener('controllerchange', changed);
					changed();
				});
			})(),
			new Promise((_, reject) => {
				timer = setTimeout(() => reject(new Error('The app could not start. Reload this page and try again.')), 20000);
			})
		]);
	} finally { cancelled = true; clearTimeout(timer); cleanup(); }
}

async function download(release) {
	if (release.schema !== 1 || !/^[a-f0-9]{20}$/.test(release.version) ||
		!/^\/velora-bundle\.[a-f0-9]{20}\.gz$/.test(release.bundle)) throw new Error('Unsupported app release.');
	if (typeof DecompressionStream === 'undefined') throw new Error('Please update your browser to download Velora.');
	const response = await fetch(release.bundle, { cache: 'no-store', signal: AbortSignal.timeout(120000) });
	if (!response.ok) throw new Error('The app download is unavailable. Try again in a moment.');
	const reader = response.body.getReader();
	const chunks = [];
	let loaded = 0;
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		chunks.push(value);
		loaded += value.length;
		show('Downloading Velora…', Math.min(.75, loaded / release.compressedBytes * .75));
		detail.textContent = `${(loaded / 1048576).toFixed(1)} / ${(release.compressedBytes / 1048576).toFixed(1)} MB`;
	}
	const zipped = await new Blob(chunks).arrayBuffer();
	const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', zipped))].map(byte => byte.toString(16).padStart(2, '0')).join('');
	if (digest !== release.sha256) throw new Error('The download was incomplete. Please try again.');
	show('Saving your app…', .76);
	const raw = await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
	const indexSize = new DataView(raw).getUint32(0);
	if (indexSize > raw.byteLength - 4) throw new Error('Invalid app package.');
	const entries = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 4, indexSize)));
	const dataStart = 4 + indexSize;
	const cache = await caches.open(cacheName(release.version));
	try {
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const asset = release.assets[entry.path];
			if (!asset || new URL(entry.path, location.href).origin !== location.origin ||
				!Number.isInteger(entry.start) || !Number.isInteger(entry.size) || entry.start < 0 || entry.size < 0 ||
				dataStart + entry.start + entry.size > raw.byteLength) throw new Error('Invalid app package entry.');
			await cache.put(entry.path, new Response(raw.slice(dataStart + entry.start, dataStart + entry.start + entry.size), {
				headers: { 'Content-Type': asset.type, 'Cache-Control': 'no-cache' }
			}));
			show('Saving your app…', .76 + (i + 1) / entries.length * .23);
		}
		if (!await cache.match(release.entry)) throw new Error('The app package is missing its start page.');
		// Only publish a fully installed version. Failed updates retain the saved app.
		await (await caches.open(CONTROL)).put(CURRENT, new Response(JSON.stringify(release)));
	} catch (error) {
		await caches.delete(cacheName(release.version));
		throw error;
	}
}

async function openApp(release) {
	const cached = await (await caches.open(cacheName(release.version))).match(release.entry);
	if (!cached) throw new Error('Your saved copy is unavailable. Reload to download it again.');
	show('Opening Velora…', 1);
	const html = await cached.text();
	// Keep the current origin and route so the existing proxy and app iframes work.
	document.open();
	document.write(html);
	document.close();
}

async function start() {
	retry.hidden = true;
	try {
		if (!isSecureContext || !navigator.serviceWorker || !window.caches) {
			throw new Error('Open this site using HTTPS. Velora needs secure browser storage.');
		}
		show('Preparing your space…');
		const saved = await readSaved();
		let release = saved;
		// Embedded app routes reuse the already checked version to avoid repeated downloads.
		if (!saved || window.top === window) {
			try {
				const response = await fetch('/velora-release.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
				if (!response.ok) throw new Error('The latest app version is unavailable.');
				release = await response.json();
			} catch (error) { if (!saved) throw error; }
		}
		await controlPage();
		if (release.version !== saved?.version) {
			const install = async () => {
				// Another tab may have completed this same download while we waited.
				if ((await readSaved())?.version !== release.version) await download(release);
			};
			try {
				if (navigator.locks) await navigator.locks.request('velora-static-install', install);
				else await install();
			}
			catch (error) { if (!saved) throw error; release = saved; }
		}
		await openApp(release);
		// Keep the previous cache for tabs that still use the previous app's chunks.
		if (saved && saved.version !== release.version) {
			for (const name of await caches.keys()) {
				if (name.startsWith('velora-static-') && ![CONTROL, cacheName(saved.version), cacheName(release.version)].includes(name)) await caches.delete(name);
			}
		}
	} catch (error) {
		show('Velora could not finish loading');
		detail.textContent = error instanceof Error ? error.message : 'Reload the page and try again.';
		retry.hidden = false;
	}
}
retry.addEventListener('click', start);
start();
