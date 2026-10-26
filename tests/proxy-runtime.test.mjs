import test from 'node:test';
import assert from 'node:assert/strict';
import { createProxyRuntime } from '../src/lib/lethe/runtime.js';

function fixture() {
	const calls = [];
	const controller = {};
	const connection = {};
	const polygon = { async init() { calls.push('polygon-init'); } };
	const dependencies = {
		async loadScript(path) { calls.push(path); },
		async registerProxyWorker() { calls.push('worker'); },
		createConnection() { calls.push('connection'); return connection; },
		async setCar(_, car, wisp) { calls.push(['legacy', car, wisp]); },
		createScramjetController() { return polygon; },
		async createPrismController(car, wisp) { calls.push(['prism', car, wisp]); return controller; },
		async setPrismTransport(car, wisp) { calls.push(['prism-transport', car, wisp]); },
		async enablePopups() { calls.push('popups'); }
	};
	return { calls, controller, dependencies };
}

test('an early click shares SJ2 warmup without loading legacy engines or a second relay', async () => {
	const f = fixture();
	let release;
	const gate = new Promise(resolve => { release = resolve; });
	f.dependencies.createPrismController = async () => { f.calls.push('prism-start'); await gate; return f.controller; };
	const runtime = createProxyRuntime({ dependencies: f.dependencies, interceptPopups: true });
	const warmup = runtime.prepare();
	const click = runtime.prepare('prism');
	assert.equal(click, warmup);
	await new Promise(resolve => setImmediate(resolve));
	assert.deepEqual(f.calls, ['prism-start']);
	release();
	assert.equal((await click).controller, f.controller);
	await runtime.prepare('sj2');
	assert.deepEqual(f.calls, ['prism-start', ['prism-transport', 'libcurl', undefined]]);
});

test('legacy engines load on selection, share their relay, and initialize SJ only once', async () => {
	const f = fixture();
	const runtime = createProxyRuntime({ dependencies: f.dependencies, interceptPopups: true });
	await runtime.prepare('uv');
	assert.ok(f.calls.includes('/glass/glass.bundle.js'));
	assert.ok(!f.calls.includes('/poly/polygon.all.js'));
	assert.ok(!f.calls.includes('polygon-init'));
	await runtime.prepare('sj');
	await runtime.prepare('uv');
	await runtime.prepare('polygon');
	assert.equal(f.calls.filter(x => x === 'connection').length, 1);
	assert.equal(f.calls.filter(x => x === 'polygon-init').length, 1);
	assert.equal(f.calls.filter(x => x === 'popups').length, 1);
	assert.equal(f.calls.filter(x => Array.isArray(x) && x[0] === 'legacy').length, 1);
});

test('transport changes wait in order and preserve a custom relay', async () => {
	const f = fixture();
	const runtime = createProxyRuntime({ dependencies: f.dependencies });
	const wisp = 'wss://custom.example/wisp/';
	await runtime.prepare('sj2', 'libcurl', wisp);
	await Promise.all([runtime.prepare('sj2', 'epoxy', wisp), runtime.prepare('sj2', 'libcurl', wisp)]);
	assert.deepEqual(f.calls.filter(x => x[0] === 'prism-transport'), [
		['prism-transport', 'libcurl', wisp], ['prism-transport', 'epoxy', wisp], ['prism-transport', 'libcurl', wisp]
	]);
});

test('a failed background warmup can be retried by the next click', async () => {
	const f = fixture();
	let attempts = 0;
	f.dependencies.createPrismController = async () => {
		if (++attempts === 1) throw new Error('Offline');
		return f.controller;
	};
	const runtime = createProxyRuntime({ dependencies: f.dependencies });
	await assert.rejects(runtime.prepare(), /Offline/);
	assert.equal((await runtime.prepare()).controller, f.controller);
	assert.equal(attempts, 2);
});

test('changing a preference back during cold startup still applies the final choice', async () => {
	const f = fixture();
	const runtime = createProxyRuntime({ dependencies: f.dependencies });
	await Promise.all([
		runtime.prepare('sj2', 'libcurl'),
		runtime.prepare('sj2', 'epoxy'),
		runtime.prepare('sj2', 'libcurl')
	]);
	assert.deepEqual(f.calls.filter(x => x[0] === 'prism-transport').map(x => x[1]), ['libcurl', 'epoxy', 'libcurl']);
});
