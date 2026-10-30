import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeedLab, getSpeedLab, readPageTimings, summarizeRuns, speedReport } from '../src/lib/utils/developer/speed.js';
import { setDeveloperMode } from '../src/lib/utils/developer/diagnostics.js';

test('summaries exclude failed requests and report the median of successes', () => {
	const runs = [120, 300, 200, 90, 160].map(responseMs => ({ ok:true, responseMs, totalMs:responseMs + 20 }));
	runs.push({ ok:false, responseMs:5, totalMs:6 });
	assert.deepEqual(summarizeRuns(runs), { succeeded:5, failed:1, median:160, fastest:90, slowest:300, htmlMedian:180 });
	assert.equal(summarizeRuns(runs.slice(0, 2)).median, 210);
	assert.equal(summarizeRuns([{ ok:false, responseMs:10, totalMs:20 }]).median, null);
});

test('a test makes exactly five sequential cache-bypassing GETs and includes body time', async () => {
	let time = 0, active = 0, maxActive = 0, recorded;
	const calls = [];
	const lab = createSpeedLab({ now:() => time, fetch:async (path, options) => {
		calls.push({ path, options }); active++; maxActive = Math.max(maxActive, active); time += 100;
		return { status:200, ok:true, arrayBuffer:async () => { time += 40; active--; return new ArrayBuffer(123); } };
	}, record:(...args) => { recorded = args; } });
	const result = await lab.run('/apps');
	assert.equal(calls.length, 5); assert.equal(maxActive, 1);
	for (const { path, options } of calls) {
		assert.equal(path, '/apps'); assert.equal(options.method, 'GET'); assert.equal(options.cache, 'no-store');
		assert.equal(options.credentials, 'same-origin'); assert.equal(options.redirect, 'error');
	}
	assert.equal(result.summary.median, 100); assert.equal(result.summary.htmlMedian, 140);
	assert.equal(result.runs[0].bytes, 123); assert.equal(result.running, false);
	assert.equal(recorded[0], '/apps');
});

test('targets cannot send requests to arbitrary URLs or private callback paths', async () => {
	let calls = 0;
	const lab = createSpeedLab({ fetch:async () => { calls++; } });
	for (const target of ['https://external.test', '//external.test', '/api?token=private', '/callback/private']) {
		await assert.rejects(lab.run(target), /Choose a Velora page/);
	}
	assert.equal(calls, 0);
});

test('HTTP failures, network failures and timeouts remain failures without private error text', async () => {
	let calls = 0, timeout;
	const lab = createSpeedLab({ setTimer:callback => { timeout = callback; return 1; }, clearTimer:() => {}, fetch:async (_path, { signal }) => {
		calls++;
		if (calls === 1) return { status:403, ok:false, arrayBuffer:async () => new ArrayBuffer(1) };
		if (calls === 2) return new Promise((_resolve, reject) => { signal.addEventListener('abort', () => reject(new Error('secret timeout URL'))); timeout(); });
		throw new Error('private session token');
	} });
	const state = await lab.run();
	assert.equal(state.summary.succeeded, 0); assert.equal(state.summary.failed, 5); assert.equal(state.summary.median, null);
	assert.equal(state.runs[0].status, 403); assert.equal(state.runs[1].error, 'Timed out');
	assert.doesNotMatch(speedReport(state, {}), /secret|private|session token/);
});

test('stop aborts the in-flight request and prevents later requests or completion records', async () => {
	let calls = 0, signal, records = 0;
	const lab = createSpeedLab({ fetch:(_path, options) => {
		calls++; signal = options.signal;
		return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('stopped'))));
	}, record:() => records++ });
	const pending = lab.run();
	lab.cancel(); await pending;
	assert.equal(signal.aborted, true); assert.equal(calls, 1); assert.equal(records, 0);
	assert.equal(lab.snapshot().running, false); assert.equal(lab.snapshot().cancelled, true);
	assert.equal(lab.snapshot().runs.length, 0);
});

test('shared lab rejects overlapping runs and clearing prevents old results reappearing', async () => {
	let resolveRequest, calls = 0;
	const lab = createSpeedLab({ fetch:() => { calls++; return new Promise(resolve => { resolveRequest = resolve; }); } });
	const pending = lab.run('/apps');
	await lab.run('/books'); assert.equal(calls, 1);
	lab.clear();
	resolveRequest({ ok:true, status:200, arrayBuffer:async () => new ArrayBuffer(0) });
	await pending;
	assert.equal(lab.snapshot().runs.length, 0); assert.equal(lab.snapshot().startedAt, null);
	assert.equal(lab.snapshot().target, '/');
});

test('disabled developer mode makes no requests', async () => {
	let calls = 0;
	const lab = createSpeedLab({ enabled:() => false, fetch:async () => { calls++; } });
	await lab.run(); assert.equal(calls, 0); assert.equal(lab.snapshot().running, false);
});

test('desktop and Settings share one lab, and disabling developer mode aborts and clears it', async () => {
	const storage = new Map(); let calls = 0, signal;
	const host = {
		location:{ origin:'https://velora.test', pathname:'/' },
		document:{ querySelector:() => ({}) }, addEventListener:() => {},
		performance:{ now:() => 1 },
		localStorage:{ getItem:key => storage.get(key) ?? null, setItem:(key, value) => storage.set(key, value) },
		fetch:(_path, options) => { calls++; signal = options.signal; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('stopped')))); }
	};
	host.parent = host;
	const child = { parent:host, document:host.document };
	const lab = getSpeedLab(host);
	assert.equal(getSpeedLab(child), lab);
	await lab.run(); assert.equal(calls, 0);
	setDeveloperMode(true, host);
	const pending = lab.run();
	setDeveloperMode(false, host); await pending;
	assert.equal(signal.aborted, true); assert.equal(calls, 1);
	assert.equal(lab.snapshot().runs.length, 0); assert.equal(lab.snapshot().startedAt, null);
});

test('navigation milestones use genuine performance entries and keep missing timings unavailable', () => {
	const performance = { getEntriesByType:type => ({
		navigation:[{ startTime:0, responseStart:123.45, responseEnd:150, domContentLoadedEventEnd:420, loadEventEnd:0 }],
		paint:[{ name:'first-contentful-paint', startTime:250 }],
		resource:[{ transferSize:500 }, { transferSize:0 }, { transferSize:Infinity }]
	})[type] };
	assert.deepEqual(readPageTimings(performance), { firstByte:123.5, htmlComplete:150, contentPaint:250, domReady:420, pageLoad:null, resources:3, transferBytes:500 });
	assert.equal(readPageTimings(undefined).pageLoad, null);
	assert.deepEqual(readPageTimings({ getEntriesByType:() => { throw new Error('unsupported'); } }), {});
});
