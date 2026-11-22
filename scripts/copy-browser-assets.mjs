import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { refluxPath } from '@nightnetwork/reflux';

// The standalone reset page shares the same protocol and cleanup logic as the app.
cpSync('src/lib/utils/reset-core.js', 'static/reset-core.js');
cpSync('src/lib/utils/restore-state.js', 'static/restore-state.js');
buildSync({ entryPoints: ['src/lib/utils/restore-page.js'], outfile: 'static/site-restore.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none' });
buildSync({ entryPoints: ['src/lib/utils/connection-help.js'], outfile: 'static/connection-help.js', bundle: true, format: 'iife', globalName: 'VeloraConnectionHelp', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none' });
buildSync({ entryPoints: ['src/lib/lethe/bare-relay-transport.js'], outfile: 'static/relay-transport.mjs', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none' });

for (const [source, folder] of [
  ['glass', 'glass'],
  ['poly', 'poly'],
  ['prism', 'prism'],
  [epoxyPath, 'libbybutslightlyworse'],
  [libcurlPath, 'libby'],
  [baremuxPath, 'charon'],
  [refluxPath, 'reflux']
]) {
  const target = `static/${folder}`;
  mkdirSync(target, { recursive: true });
  cpSync(source, target, {
    recursive: true,
    filter: p => !p.split(/[\\/]/).includes('.git')
  });
}

// The legacy engines use the BareMux v1 interface. Port the same startup
// optimization to that build while preserving its request and response types.
const legacyLibcurl = readFileSync('static/libby/index.mjs', 'utf8');
const clientMarker = '// src/main.ts\nvar LibcurlClient = class {';
const startup = /  async init\(\) \{\n    if \(this\.transport\)[\s\S]*?(?=    libcurl\.set_websocket\(this\.wisp\);)/;
if (!legacyLibcurl.includes(clientMarker) || !startup.test(legacyLibcurl)) {
  throw new Error('Update the Velora startup patch for this legacy Libcurl build.');
}
const optimizedLibcurl = legacyLibcurl
  .replace(clientMarker, clientMarker.replace('var LibcurlClient', 'let wasmStartup;\nvar LibcurlClient'))
  .replace(startup, `  #initialization;
  init() {
    return (this.#initialization ??= this.#initialize().finally(() => {
      this.#initialization = undefined;
    }));
  }
  async #initialize() {
    if (this.transport) libcurl.transport = this.transport;
    if (!libcurl.ready) {
      wasmStartup ??= Promise.resolve(libcurl.load_wasm()).finally(() => {
        wasmStartup = undefined;
      });
      await wasmStartup;
    }
`);
writeFileSync('static/libby/index.velora.mjs', optimizedLibcurl);
