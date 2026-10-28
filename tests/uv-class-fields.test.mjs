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
const uv = new context.self.Ultraviolet({ meta:{ origin:'https://proxy.test', base:new URL('https://login.example/chunk.js') } });

test('Angular-style injector declarations remain valid JavaScript after rewriting', () => {
	const input = 'class Base {} class Injector extends Base { parent; source; scopes; records = new Map; _onDestroyHooks = []; constructor(parent) { super(); this.parent = parent; } }';
	const output = uv.rewriteJS(input);
	assert.match(output, /\{ parent;/);
	assert.doesNotThrow(() => new vm.Script(output));
	assert.doesNotMatch(output, /\{ __uv\.\$get\(parent\);/);
});

test('public, initialized and static field names are properties rather than globals', () => {
	for (const name of ['parent', 'top', 'location', 'eval']) {
		const code = `class State { ${name} = 7; static ${name} = 9; } const state = new State; [state['${name}'], State['${name}'], Object.keys(state)[0]];`;
		const output = uv.rewriteJS(code);
		assert.doesNotThrow(() => new vm.Script(output));
		assert.deepEqual(Array.from(vm.runInNewContext(output, { __uv:{ $wrap:value => value } })), [7,9,name]);
	}
});

test('computed class keys and field initializers still rewrite global references', () => {
	const output = uv.rewriteJS("class State { [parent] = top; location = parent; } const value = new State; [value['parentKey'], value['location']];");
	assert.match(output, /\[__uv\.\$get\(parent\)\]/);
	assert.match(output, /location = __uv\.\$get\(parent\)/);
	const calls = [];
	const result = vm.runInNewContext(output, { parent:'parentKey', top:'topValue', __uv:{ $wrap:value => value, $get(value) { calls.push(value); return value; } } });
	assert.deepEqual(Array.from(result), ['topValue','parentKey']);
	assert.deepEqual(calls, ['parentKey','topValue','parentKey']);
});

test('private fields and ordinary methods keep their original behavior', () => {
	const output = uv.rewriteJS("class State { #parent = 4; parent = 2; value() { return this.#parent; } } new State()['value']();");
	assert.doesNotThrow(() => new vm.Script(output));
	assert.equal(vm.runInNewContext(output, { __uv:{ $wrap:value => value } }), 4);
});

test('class-field fix does not disable browser-global or ES module URL rewriting', () => {
	const globalRead = uv.rewriteJS('const result = [parent, top, location];');
	for (const name of ['parent','top','location']) assert.ok(globalRead.includes(`__uv.$get(${name})`));
	const module = uv.rewriteJS('import { Service } from "./service.js"; export class Injector extends Service { parent; static top = 1; }');
	assert.match(module, /from "https:\/\/proxy\.test\/service\//);
	assert.match(module, /\{ parent;/);
	assert.doesNotThrow(() => uv.js.parse(module, uv.js.parseOptions));
});

test('the generated worker/browser bundle matches its canonical source', () => {
	assert.equal(readFileSync(new URL('../static/glass/glass.bundle.js', import.meta.url), 'utf8'), source);
});
