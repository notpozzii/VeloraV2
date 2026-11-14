import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('SVG adaptation keeps its root and makes HTML elements in the proper namespace', () => {
  const root = { namespaceURI: 'http://www.w3.org/2000/svg' };
  const body = {}, head = {};
  const calls = [];
  const templates = { createElement(tag, options) { calls.push(['template', tag, options]); return { tag, ownerDocument: templates }; } };
  const document = {
    documentElement: root, body: null, head: null,
    getElementById(id) { return { 'velora-svg-body': body, 'velora-svg-head': head }[id]; },
    implementation: { createHTMLDocument() { return templates; } },
    createElement() { assert.fail('The native XML createElement would create the wrong namespace'); },
    createElementNS(namespace, tag, options) { calls.push([namespace, tag, options]); return { namespace, tag, options, ownerDocument: document }; }
  };
  const nativeCreateElementNS = document.createElementNS;
  vm.runInNewContext(readFileSync(new URL('../src/lib/downloads/portable/svg-document.js', import.meta.url), 'utf8'), { document });
  assert.equal(document.body, body);
  assert.equal(document.head, head);
  assert.equal(document.documentElement, root);
  assert.equal(document.createElement('INPUT').namespace, 'http://www.w3.org/1999/xhtml');
  assert.equal(document.createElement('input').ownerDocument, document);
  assert.equal(document.createElement('template').ownerDocument, templates);
  assert.equal(document.createElementNS, nativeCreateElementNS);
  assert.equal(document.createElementNS(root.namespaceURI, 'svg').namespace, root.namespaceURI);
});
