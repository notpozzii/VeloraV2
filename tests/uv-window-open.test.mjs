import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const canonical = readFileSync(new URL('../glass/glass.handler.js', import.meta.url), 'utf8');

// Exercise the actual shipped override, rather than a second implementation of
// it. Native window.open must receive the rewritten URL AND its browsing target.
function fixture() {
	const calls = [], rewrites = [];
	const receiver = {}, nativeWindow = { location:{}, focus() {}, close() {} };
	const start = canonical.indexOf('a.override(o,"open",');
	const end = canonical.indexOf('),e.$wrap=', start);
	assert.ok(start >= 0 && end > start, 'Locate the shipped window.open override');
	let hook;
	vm.runInNewContext(canonical.slice(start, end + 1), {
		o:receiver,
		a:{ override(target, name, handler) { assert.equal(target, receiver); assert.equal(name, 'open'); hook = handler; } },
		e:{ rewriteUrl(url) { rewrites.push(url); return `proxy:${url}`; } }
	});
	const native = function (...args) { calls.push({ receiver:this, args }); return nativeWindow; };
	return { calls, rewrites, receiver, nativeWindow, open:(...args) => hook(native, receiver, args) };
}

test('GeForce same-tab sign-in stays in its frame and returns the native window', () => {
	const f = fixture();
	assert.equal(f.open('https://login.nvidia.com/authorize?state=test', '_self'), f.nativeWindow);
	assert.deepEqual(f.rewrites, ['https://login.nvidia.com/authorize?state=test']);
	assert.deepEqual(f.calls[0].args, ['proxy:https://login.nvidia.com/authorize?state=test', '_self']);
	assert.equal(f.calls[0].receiver, f.receiver);
});

test('intentional auth popups keep their name, features, and native opener context', () => {
	const f = fixture();
	const popup = f.open('https://accounts.example/login', 'account_login', 'popup,width=520,height=640');
	assert.equal(popup, f.nativeWindow);
	assert.deepEqual(f.calls[0].args, ['proxy:https://accounts.example/login', 'account_login', 'popup,width=520,height=640']);
});

test('all browsing targets and an omitted target retain browser-native semantics', () => {
	for (const target of ['_blank', '_parent', '_top', '_self', 'named_tab', undefined]) {
		const f = fixture();
		f.open('https://example.com/', target);
		assert.deepEqual(f.calls[0].args, ['proxy:https://example.com/', target]);
	}
	const f = fixture();
	f.open('https://example.com/');
	assert.deepEqual(f.calls[0].args, ['proxy:https://example.com/']);
});

test('opening an empty window does not invent a URL or lose its native return value', () => {
	const f = fixture();
	assert.equal(f.open(), f.nativeWindow);
	assert.deepEqual(f.rewrites, []);
	assert.deepEqual(f.calls[0].args, []);
});

test('the generated browser asset includes the same fix as its canonical source', () => {
	assert.equal(readFileSync(new URL('../static/glass/glass.handler.js', import.meta.url), 'utf8'), canonical);
});

for (const file of ['../src/lib/utils/browser/iframe.svelte', '../src/lib/lethe/reflux.js']) {
	test(`${file.split('/').at(-1)} respects same-tab redirects before popup interception`, () => {
		const source = readFileSync(new URL(file, import.meta.url), 'utf8');
		const assignment = source.match(/targetWindow\.open = function \(url, name[^)]*\) \{[\s\S]*?\n[ \t]*\};/);
		assert.ok(assignment, 'Locate the actual popup-interception hook');
		const nativeCalls = [], popupCalls = [];
		const nativeWindow = { location:{} }, fakePopup = {};
		const targetWindow = {};
		const nativeOpen = function (...args) { nativeCalls.push({ receiver:this, args }); return nativeWindow; };
		vm.runInNewContext(assignment[0], {
			targetWindow, nativeOpen, interceptEnabled:true, isEnabled:() => true,
			openTabForUrl:url => popupCalls.push(url), emitNewTab:url => popupCalls.push(url), dudWindow:() => fakePopup
		});
		assert.equal(targetWindow.open('https://login.nvidia.com/authorize', '_self', 'noopener'), nativeWindow);
		assert.equal(targetWindow.open('https://login.nvidia.com/authorize', '_SELF'), nativeWindow);
		assert.deepEqual(nativeCalls[0].args, ['https://login.nvidia.com/authorize', '_self', 'noopener']);
		assert.equal(nativeCalls[0].receiver, targetWindow);
		assert.deepEqual(popupCalls, []);
		assert.equal(targetWindow.open('https://example.com/', '_blank'), fakePopup);
		assert.deepEqual(popupCalls, ['https://example.com/']);
	});
}
