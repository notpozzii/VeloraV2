import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// The bundled engine uses RegExp modifiers, supported by Node 24+.
const publicDir = new URL('../static/geforce-runtime/', import.meta.url);
globalThis.self = globalThis;
vm.runInThisContext(readFileSync(new URL('prism.js', publicDir), 'utf8'));
const api = self.$scramjet;
api.setWasm(new Uint8Array(readFileSync(new URL('prism.wasm', publicDir))));
const codecSource = readFileSync(new URL('../src/lib/lethe/codec.js', import.meta.url), 'utf8');
const { codec } = await import(`data:text/javascript;base64,${Buffer.from(codecSource).toString('base64')}`);

for (const [name, encode, decode] of [
  ['Velora XOR', codec.encode, codec.decode],
  ['URI', encodeURIComponent, decodeURIComponent],
  ['identity', (s) => s, (s) => s]
]) {
  test(`${name}: HTML module and cyclic static import share one module identity`, () => {
    const context = {
      prefix: new URL('https://proxy.test/prism/controller/frame/'),
      config: structuredClone(api.defaultConfig),
      interface: { codecEncode: encode, codecDecode: decode }
    };
    const origin = new URL('https://static-login.nvidia.com/service/gfn/consent/gaming/v1-1');
    const meta = { origin, base: new URL('https://static-login.nvidia.com/service/gfn/assets/UserConsents.js') };
    const rewritten = api.rewriteJs('import { useState } from "./index.js"; export { useState };', meta.base.href, context, meta, true);
    const code = typeof rewritten === 'string' ? rewritten : new TextDecoder().decode(rewritten);
    const imported = new URL(code.match(/from "([^"]+)"/)[1], context.prefix);
    const htmlModule = new URL(api.rewriteUrl('./index.js', context, meta, { isModule: true }));
    assert.equal(htmlModule.href, imported.href, 'a second URL evaluates React a second time');
    assert.equal(imported.searchParams.get('$io'), origin.origin);
    assert.equal(imported.searchParams.get('$module'), 'module');
    const ordinary = new URL(api.rewriteUrl('./index.js', context, meta));
    assert.equal(ordinary.searchParams.get('$io'), encode(origin.origin), 'ordinary fetch metadata remains compatible');
  });
}
