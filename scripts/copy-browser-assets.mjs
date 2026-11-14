import { cpSync, mkdirSync } from 'node:fs';
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
