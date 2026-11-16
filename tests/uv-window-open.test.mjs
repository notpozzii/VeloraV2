import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const canonical = readFileSync(new URL('../glass/glass.handler.js', import.meta.url), 'utf8');

// Exercise the actual shipped override, rather than a second implementation of
// it. Native window.open must receive the rewritten URL AND its browsing target.
function fixture({ blocked = false, inaccessible = false } = {}) {
	const calls = [], rewrites = [], initialized = [];
	const receiver = {}, nativeWindow = { location:{ href:"about:blank" }, focus() {}, close() {} };
	const start = canonical.indexOf('a.override(o,"open",');
	const end = canonical.indexOf('),e.$wrap=', start);
	assert.ok(start >= 0 && end > start, 'Locate the shipped window.open override');
	if (inaccessible) Object.defineProperty(nativeWindow, "location", { get() { throw new Error("cross origin"); } });
	const meta = { url:new URL("https://play.geforcenow.com/mall/"), base:"https://play.geforcenow.com/mall/" };
	let hook;
	vm.runInNewContext(canonical.slice(start, end + 1), {
		o:receiver,
		a:{ override(target, name, handler) { assert.equal(target, receiver); assert.equal(name, 'open'); hook = handler; } },
		p(popup, inheritedMeta) { initialized.push({popup, inheritedMeta}); },
		e:{ meta, rewriteUrl(url) { rewrites.push(url); return `proxy:${url}`; } }
	});
	const native = function (...args) { calls.push({ receiver:this, args }); return blocked ? null : nativeWindow; };
	return { calls, rewrites, initialized, meta, receiver, nativeWindow, open:(...args) => hook(native, receiver, args) };
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

test('blank account windows get their own proxy realm before the async redirect', () => {
	for (const args of [[], [''], [undefined], [null], ['about:blank', 'epic_login', 'popup,width=520,height=640']]) {
		const f = fixture();
		assert.equal(f.open(...args), f.nativeWindow);
		assert.equal(f.initialized.length, 1, 'initialize the native blank window synchronously');
		assert.equal(f.initialized[0].popup, f.nativeWindow);
		assert.equal(f.initialized[0].inheritedMeta, f.meta, 'relative redirects inherit the opener URL');
		if (!args.length || args[0] == null || args[0] === '') {
			assert.deepEqual(f.rewrites, [], 'do not turn an empty URL into a proxied undefined URL');
			assert.deepEqual(f.calls[0].args, args);
		}
	}
});

test('blocked popups and inaccessible named windows retain native behavior', () => {
	const blocked = fixture({blocked:true});
	assert.equal(blocked.open('', 'epic_login'), null);
	assert.deepEqual(blocked.initialized, []);
	const inaccessible = fixture({inaccessible:true});
	assert.equal(inaccessible.open('', 'epic_login'), inaccessible.nativeWindow);
	assert.deepEqual(inaccessible.initialized, []);
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
