import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../glass/glass.bundle.js', import.meta.url), 'utf8');
const context = {
	URL, TextEncoder, TextDecoder, Event, EventTarget, Blob, Response, Request, Headers,
	self:{}, console:{ debug() {} }, navigator:{ serviceWorker:{} },
	MessagePort:class { postMessage() {} }, WebSocket:class { send() {} }
};
vm.runInNewContext(source, context);
const UV = context.self.Ultraviolet;
const base = 'https://play.geforcenow.com/mall/';

for (const codec of ['xor', 'plain', 'base64']) {
	// The production engine uses XOR; exercise the other configurable codecs too.
	context.btoa = value => Buffer.from(value, 'binary').toString('base64');
	context.atob = value => Buffer.from(value, 'base64').toString('binary');
	function engine() {
		return new UV({ prefix:'/service/glass/', encodeUrl:UV.codec[codec].encode,
			decodeUrl:UV.codec[codec].decode, meta:{ origin:'https://proxy.test', base:new URL(base) } });
	}
	test(`${codec}: native hash navigation survives OAuth return-route capture`, () => {
		const uv = engine();
		const pageUrl = uv.rewriteUrl(base) + '#/loginwall';
		const returnUrl = uv.sourceUrl(pageUrl);
		assert.equal(returnUrl, base + '#/loginwall');
		// NVIDIA stores this URL before leaving the page and opens it in _self.
		const callbackDestination = new URL(uv.rewriteUrl(returnUrl));
		assert.equal(callbackDestination.hash, '#/loginwall');
		assert.equal(new URL(uv.sourceUrl(callbackDestination.origin + callbackDestination.pathname)).pathname, '/mall/');
	});
	test(`${codec}: rewritten fragments stay outside the network request`, () => {
		const uv = engine();
		for (const hash of ['#/loginwall', '#!/route', '#one%20two', '#route?tab=1']) {
			const target = base + '?language=en' + hash;
			const proxyUrl = new URL(uv.rewriteUrl(target));
			assert.equal(proxyUrl.hash, hash);
			assert.equal(uv.sourceUrl(proxyUrl.href), target);
			assert.equal(uv.sourceUrl(proxyUrl.origin + proxyUrl.pathname), base + '?language=en');
		}
	});
	test(`${codec}: existing encoded fragments remain readable and native fragments replace them`, () => {
		const uv = engine();
		const legacyUrl = 'https://proxy.test/service/glass/' + UV.codec[codec].encode(base + '#old');
		assert.equal(uv.sourceUrl(legacyUrl), base + '#old');
		assert.equal(uv.sourceUrl(legacyUrl + '#new'), base + '#new');
	});
}

test('generated deployment bundle matches the canonical fragment fix', () => {
	assert.equal(readFileSync(new URL('../static/glass/glass.bundle.js', import.meta.url), 'utf8'), source);
});
