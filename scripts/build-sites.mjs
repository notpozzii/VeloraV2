import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

// Keep SvelteKit's existing server routing and proxy assets. Sites expects a
// self-contained Worker entry under dist/server and static files under client.
await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await cp('.svelte-kit/cloudflare', 'dist/client', {
  recursive: true,
  filter: path => !path.endsWith('/_worker.js') && !path.endsWith('/_routes.json')
});
const robloxRuntimeFiles = Object.fromEntries(await Promise.all(
	['auth.html', 'play.html', 'bridge.js', 'player.js', 'engine-worker.js'].map(async file =>
		[file, await readFile(`static/roblox/${file}`, 'utf8')])
));
// Keep these paths out of the host's asset-first routing so the Worker can set
// the shared-memory isolation headers on HTML and pthread responses.
await rm('dist/client/roblox', { recursive: true, force: true });
await build({
  entryPoints: ['scripts/sites-worker.mjs'],
  outfile: 'dist/server/index.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
	define: { __VELORA_ROBLOX_RUNTIME_FILES__: JSON.stringify(robloxRuntimeFiles) },
  external: ['cloudflare:*', 'node:*'],
  legalComments: 'none',
  minify: true
});
// Stop older service-worker code surviving an update of a direct deployment.
await writeFile('dist/client/_headers', `/_app/immutable/*
  Cache-Control: public, max-age=31536000, immutable
/servy.js
  Cache-Control: no-store
  Service-Worker-Allowed: /
/proxy-route-recovery.js
  Cache-Control: no-cache
/proxy-reconnect.js
  Cache-Control: no-cache
/prism/prism.sw.js
  Cache-Control: no-cache
/prism/prism.api.js
  Cache-Control: no-cache
/prism/prism.inject.js
  Cache-Control: no-cache
/prism/stream-transfer.js
  Cache-Control: no-cache
/geforce/servy.js
  Cache-Control: no-store
  Service-Worker-Allowed: /geforce/
/geforce/route-recovery.js
  Cache-Control: no-cache
/geforce-runtime/*
  Cache-Control: no-cache
/roblox/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Document-Isolation-Policy: isolate-and-require-corp
  Cross-Origin-Resource-Policy: same-origin
  Cache-Control: no-cache
`);
try {
  const manifest = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
  if (manifest.static) throw new Error('Direct Velora requires a Worker hosting manifest.');
  await mkdir('dist/.openai', { recursive: true });
  await writeFile('dist/.openai/hosting.json', JSON.stringify(manifest, null, 2) + '\n');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log('Built the full Velora app for Sites: dist/server/index.js + dist/client');
