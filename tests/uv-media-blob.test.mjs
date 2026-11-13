import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../glass/glass.handler.js', import.meta.url), 'utf8');
function fixture() {
  class Media {}
  class Source {}
  const urls = new Map();
  const calls = [];
  let attribute, property;
  const context = vm.createContext({
    URL, String, g: Media, S: Source,
    y: class {}, M: Media, j: Media, _: class {}, v: class {}, H: class {}, n: class {}, x: class {},
    o: { location: { origin: 'https://velora.test' } },
    e: { blobUrls: urls, attributePrefix: '__uv', sourceUrl: value => value, rewriteUrl() { assert.fail('Media blobs must not be routed through HTTP'); } },
    a: { element: {
      on(name, hook) { assert.equal(name, 'setAttribute'); attribute = hook; },
      hookProperty(types, name, hooks) { assert.ok(types.includes(Source)); property = hooks.set; },
      setAttribute() {}
    } }
  });
  vm.runInContext(source.slice(source.indexOf('function veloraMediaBlobUrl'), source.indexOf('\nvar m=')), context);
  const attributeStart = source.indexOf('a.element.on("setAttribute",');
  vm.runInContext(source.slice(attributeStart, source.indexOf('e.attrs.isUrl', attributeStart)) + '})', context);
  const propertyStart = source.indexOf('a.element.hookProperty([y,M,j,g');
  vm.runInContext(source.slice(propertyStart, source.indexOf(',a.element.hookProperty([$]', propertyStart)), context);
  return {
    urls, calls,
    assign(kind, method, value) {
      const element = kind === 'source' ? new Source() : new Media();
      if (method === 'property') property({ call(that, url) { calls.push(url); } }, element, [value]);
      else {
        const event = { that: element, target() {}, data: { name: 'src', value } };
        attribute(event); calls.push(event.data.value);
      }
      return calls.at(-1);
    }
  };
}

for (const kind of ['video', 'source']) {
  for (const method of ['attribute', 'property']) {
    test(`${kind} ${method} preserves local and cross-frame media blob URLs`, () => {
      const f = fixture();
      const virtual = 'blob:https://play.geforcenow.com/ad-video';
      const native = 'blob:https://velora.test/ad-video';
      // An ad frame has its own URL map, but can pass a media URL to its parent.
      assert.equal(f.assign(kind, method, virtual), native);
      assert.equal(f.assign(kind, method, native), native);
      assert.equal(f.assign(kind, method, `  ${virtual}  `), native);
      assert.equal(f.assign(kind, method, 'blob:null/opaque-video'), 'blob:null/opaque-video');
      f.urls.set(virtual, 'blob:https://velora.test/mapped-video');
      assert.equal(f.assign(kind, method, virtual), 'blob:https://velora.test/mapped-video');
    });
  }
}

test('the deployed handler matches the canonical media fix', () => {
  assert.equal(readFileSync(new URL('../static/glass/glass.handler.js', import.meta.url), 'utf8'), source);
});
