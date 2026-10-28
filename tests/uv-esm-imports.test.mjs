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
const moduleUrl = 'https://login.example/chunks/router.js';
function engine(base = moduleUrl) {
	return new context.self.Ultraviolet({ meta:{ origin:'https://proxy.test', base:new URL(base) } });
}
function resolveGeneratedImport(uv, specifier) {
	const output = uv.rewriteJS('import(specifier)');
	const expression = output.match(/^import\((.*)\)$/)?.[1];
	assert.ok(expression?.includes('__uv.rewriteImport('), 'Execute the actual generated helper call');
	return vm.runInNewContext(expression, { __uv:uv, specifier });
}
function originalUrl(url) {
	assert.ok(url.startsWith('https://proxy.test/service/'));
	return decodeURIComponent(url.slice('https://proxy.test/service/'.length));
}

test('generated lazy imports request the login module instead of importing the caller again', () => {
	const uv = engine();
	const url = resolveGeneratedImport(uv, './account.js');
	assert.equal(originalUrl(url), 'https://login.example/chunks/account.js');
	assert.notEqual(originalUrl(url), moduleUrl);
	const LoginModule = class {};
	const moduleGraph = new Map([[uv.rewriteUrl('./account.js'), { LoginModule }]]);
	assert.equal(moduleGraph.get(url)?.LoginModule, LoginModule);
});

test('static and dynamic imports of the same module share one module URL', () => {
	const uv = engine();
	const output = uv.rewriteJS('import { LoginModule } from "./account.js";');
	const staticUrl = output.match(/from "([^"]+)"/)?.[1];
	assert.ok(staticUrl);
	assert.equal(resolveGeneratedImport(uv, './account.js'), staticUrl);
});

test('the importing script provides the relative base, even when the page has another base', () => {
	const uv = engine('https://login.example/v3/login');
	assert.equal(originalUrl(uv.rewriteImport(moduleUrl, '../account/page.js')), 'https://login.example/account/page.js');
	assert.equal(originalUrl(uv.rewriteImport(moduleUrl, '/account/page.js')), 'https://login.example/account/page.js');
});

test('absolute specifiers, query strings, and fragments survive import rewriting', () => {
	const uv = engine();
	for (const specifier of ['./account.js?language=en#login', 'https://cdn.example/app/account.js?v=2#route']) {
		assert.equal(originalUrl(resolveGeneratedImport(uv, specifier)), new URL(specifier, moduleUrl).href);
	}
});

test('ordinary URL rewriting and the generated deployment copy remain unchanged in contract', () => {
	const uv = engine();
	assert.equal(originalUrl(uv.rewriteUrl('https://play.geforcenow.com/mall/')), 'https://play.geforcenow.com/mall/');
	assert.equal(readFileSync(new URL('../static/glass/glass.bundle.js', import.meta.url), 'utf8'), source);
});
