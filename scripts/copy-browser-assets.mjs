import { cpSync, mkdirSync } from 'node:fs';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { refluxPath } from '@nightnetwork/reflux';

// The standalone reset page shares the same protocol and cleanup logic as the app.
cpSync('src/lib/utils/reset-core.js', 'static/reset-core.js');

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
