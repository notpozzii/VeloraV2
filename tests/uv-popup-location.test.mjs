import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const canonical = readFileSync(new URL('../glass/glass.client.js', import.meta.url), 'utf8');
const start = canonical.indexOf('emulate(t,r,base){');
const end = canonical.indexOf(',Ee=T;', start);
assert.ok(start >= 0 && end > start, 'Locate the shipped Location emulator');
const emulator = vm.runInNewContext('({' + canonical.slice(start, end - 1) + '})', { URL }).emulate;

function fixture(href, base) {
	const calls = [];
	const nativeLocation = {
		href,
		assign(url) { calls.push(['assign', url, this]); },
		replace(url) { calls.push(['replace', url, this]); }
	};
	const context = {
		keys:['href', 'origin'], location:nativeLocation, href:{ get() { return this.href; } },
		ctx:{
			window:{}, nativeMethods:{ defineProperty:Object.defineProperty },
			wrap(target, name, handler) { return function (...args) { return handler(target[name], this, args); }; }
		}
	};
	const location = emulator.call(context, value => new URL(value), value => `proxy:${value}`, base);
	return { location, nativeLocation, calls };
}

for (const method of ['assign', 'replace']) {
	test(`blank popup ${method} resolves relative account URLs using its opener base`, () => {
		const f = fixture('about:blank', () => 'https://play.geforcenow.com/mall/');
		f.location[method]('../account/link?provider=epic#return');
		assert.deepEqual(f.calls, [[method, 'proxy:https://play.geforcenow.com/account/link?provider=epic#return', f.nativeLocation]]);
		assert.equal(f.location.href, 'about:blank', 'the blank URL itself retains native semantics');
	});
	test(`${method} keeps absolute URLs and its matching native navigation method`, () => {
		const f = fixture('about:blank', () => 'https://play.geforcenow.com/mall/');
		f.location[method]('https://accounts.epicgames.com/login?state=fixture');
		assert.deepEqual(f.calls, [[method, 'proxy:https://accounts.epicgames.com/login?state=fixture', f.nativeLocation]]);
	});
	test(`${method} without a supplied base keeps ordinary page navigation`, () => {
		const f = fixture('https://play.geforcenow.com/mall/');
		f.location[method]('settings');
		assert.deepEqual(f.calls, [[method, 'proxy:https://play.geforcenow.com/mall/settings', f.nativeLocation]]);
	});
}

test('deployed Location client matches the canonical popup fix', () => {
	assert.equal(readFileSync(new URL('../static/glass/glass.client.js', import.meta.url), 'utf8'), canonical);
});
