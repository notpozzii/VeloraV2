import { Server } from '../.svelte-kit/output/server/index.js';
import { manifest, prerendered, base_path } from '../.svelte-kit/cloudflare-tmp/manifest.js';
import { proxyRecoveryResponse } from './proxy-recovery-response.mjs';

// Sites runs in a dispatch Worker where caches.default is unavailable. Keep
// SvelteKit's routing, but leave static-file caching to the asset binding.
const server = new Server(manifest);
let initialized;

export default {
	async fetch(request, env, ctx) {
		const reconnect = proxyRecoveryResponse(request);
		if (reconnect) return reconnect;
		const url = new URL(request.url);
		initialized ??= server.init({
			env,
			read: async (file) => {
				const response = await env.ASSETS.fetch(new URL(`/${file}`, url.origin));
				if (!response.ok) throw new Error(`Could not read server asset: ${file} (${response.status})`);
				return response.body;
			}
		});
		await initialized;

		let pathname = url.pathname;
		try { pathname = decodeURIComponent(pathname); } catch { /* Let SvelteKit handle malformed paths. */ }
		const stripped = pathname.replace(/\/$/, '');
		const filename = stripped.slice(base_path.length + 1);
		const serverAssets = manifest._.server_assets;
		const isAsset = filename && (
			manifest.assets.has(filename) || manifest.assets.has(`${filename}/index.html`) ||
			filename in serverAssets || `${filename}/index.html` in serverAssets
		);
		const appPath = `/${manifest.appPath}`;
		if (isAsset || prerendered.has(pathname) || pathname === `${appPath}/version.json` || pathname.startsWith(`${appPath}/immutable/`)) {
			return env.ASSETS.fetch(request);
		}

		const alternate = pathname.endsWith('/') ? stripped : `${pathname}/`;
		if (alternate && prerendered.has(alternate)) {
			return new Response(null, { status: 308, headers: { location: alternate + url.search } });
		}

		return server.respond(request, {
			platform: { env, ctx, context: ctx, cf: request.cf },
			getClientAddress: () => request.headers.get('cf-connecting-ip') || '127.0.0.1'
		});
	}
};
