import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionCandidates, createAutoNavigator, autoLauncherUrl, waitForProxyDocument } from '../src/lib/lethe/auto.js';

function storage() {
	const entries = new Map();
	return { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
}

test('Auto covers all six combinations; either manual choice constrains the other', () => {
	const all = connectionCandidates('auto', 'auto', 'https://example.com');
	assert.equal(new Set(all.map(x => JSON.stringify(x))).size, 6);
	assert.deepEqual(connectionCandidates('glass', 'auto'), [{engine:'uv',car:'libcurl'}, {engine:'uv',car:'epoxy'}]);
	assert.deepEqual(connectionCandidates('auto', 'epoxy').map(x => x.engine), ['sj2','uv','sj']);
	assert.deepEqual(connectionCandidates('polygon', 'libcurlRaw'), [{engine:'sj',car:'libcurlRaw'}]);
});

test('verified media defaults use exact host boundaries and ignore cached media choices', () => {
	const cached = {engine:'sj',car:'epoxy'};
	assert.deepEqual(connectionCandidates('auto','auto','https://play.geforcenow.com/mall/',cached)[0], {engine:'uv',car:'libcurlRaw'});
	assert.deepEqual(connectionCandidates('auto','auto','https://www.tiktok.com/',cached)[0], {engine:'sj2',car:'libcurl'});
	assert.equal(connectionCandidates('auto','auto','https://geforcenow.com.example.org')[0].engine, 'sj2');
});

test('initialization and initial-document failures advance candidates and remember the working one', async () => {
	const saved = storage(); const attempts = [];
	const auto = createAutoNavigator({ storage: saved, prepare: async (engine, car, wisp) => {
		attempts.push([engine,car,wisp]);
		if (engine === 'sj2' && car === 'libcurl') throw new Error('Relay init failed');
		return {engine};
	} });
	const result = await auto.open({url:'https://example.com/',engine:'auto',car:'auto',wisp:'wss://relay.test/',load:async (session) => {
		if(session.engine === 'sj2') throw new Error('Proxy error page');
	}});
	assert.deepEqual(result, {engine:'uv',car:'libcurl'});
	assert.deepEqual(attempts, [['sj2','libcurl','wss://relay.test/'], ['sj2','epoxy','wss://relay.test/'], ['uv','libcurl','wss://relay.test/']]);
	attempts.length = 0;
	await auto.open({url:'https://example.com/next',engine:'auto',car:'auto',wisp:'wss://relay.test/',load:async()=>{}});
	assert.deepEqual(attempts, [['uv','libcurl','wss://relay.test/']]);
});

test('cached choices are scoped to the origin and relay, expire, and tolerate corrupt storage', async () => {
	let time = 1; const saved = storage(); const attempts = [];
	const auto = createAutoNavigator({storage:saved,now:()=>time,prepare:async(engine,car)=>{attempts.push([engine,car]);return {engine};}});
	const open = (url, wisp, load = async()=>{}) => auto.open({url,wisp,engine:'auto',car:'auto',load});
	await open('https://example.com','wss://one',async s=>{if(s.engine==='sj2')throw Error('fail');});
	attempts.length = 0;
	await open('https://example.com','wss://two'); assert.equal(attempts[0][0],'sj2');
	attempts.length = 0;
	await open('https://other.com','wss://one'); assert.equal(attempts[0][0],'sj2');
	time += 86400001; attempts.length = 0;
	await open('https://example.com','wss://one'); assert.equal(attempts[0][0],'sj2');
	saved.setItem('velora:auto-connections:v1','null');
	await open('https://example.com','wss://one');
});

test('manual failures do not change engines or transports; all Auto failures stop after six', async () => {
	let count = 0;
	const auto = createAutoNavigator({prepare:async()=>{count++;throw Error('Offline');}});
	await assert.rejects(auto.open({url:'https://example.com',engine:'uv',car:'epoxy',load:async()=>{}}), /Offline/);
	assert.equal(count,1); count = 0;
	await assert.rejects(auto.open({url:'https://example.com',engine:'auto',car:'auto',load:async()=>{}}), e=>e instanceof AggregateError && e.errors.length===6);
	assert.equal(count,6);
});

test('cancellation during startup prevents navigation, caching, and further attempts', async () => {
	const abort = new AbortController(); let loads = 0; let attempts = 0;
	const auto = createAutoNavigator({prepare:async()=>{attempts++;abort.abort();return {engine:'sj2'};}});
	await assert.rejects(auto.open({url:'https://example.com',engine:'auto',car:'auto',signal:abort.signal,load:async()=>{loads++;}}), {name:'AbortError'});
	assert.equal(loads,0); assert.equal(attempts,1);
});

function frameFixture() {
	const frame = new EventTarget();
	frame.contentDocument = {URL:'https://velora.test/proxy-frame.html?request=123',readyState:'complete',body:{childNodes:[1],textContent:'Ready'}};
	const doc = (title, text='Content') => ({URL:'https://velora.test/service/glass/page',title,readyState:'complete',body:{childNodes:[1],textContent:text}});
	return {frame,doc};
}

test('only a new target document confirms navigation; no later in-page action is retried', async () => {
	const {frame,doc} = frameFixture(); let navigations = 0;
	await waitForProxyDocument(frame,()=>{navigations++;frame.dispatchEvent(new Event('load'));frame.contentDocument=doc('Example');frame.dispatchEvent(new Event('load'));},{timeoutMs:100});
	frame.contentDocument=doc('Scramjet Error'); frame.dispatchEvent(new Event('load'));
	assert.equal(navigations,1);
});

test('proxy-owned errors fail while normal website errors remain website responses', async () => {
	for (const title of ['Ultraviolet Error','Scramjet Error']) {
		const {frame,doc}=frameFixture();
		await assert.rejects(waitForProxyDocument(frame,()=>{frame.contentDocument=doc(title);frame.dispatchEvent(new Event('load'));}), /proxy could not load/);
	}
	const {frame,doc}=frameFixture();
	await waitForProxyDocument(frame,()=>{frame.contentDocument=doc('404 - Example','Page not found');frame.dispatchEvent(new Event('load'));});
});

test('blank loads time out and closed launches abort promptly', async () => {
	const {frame}=frameFixture();
	await assert.rejects(waitForProxyDocument(frame,()=>{frame.contentDocument={URL:'about:blank'};frame.dispatchEvent(new Event('load'));},{timeoutMs:5}), /did not start/);
	const abort=new AbortController();
	await assert.rejects(waitForProxyDocument(frame,()=>abort.abort(),{signal:abort.signal}), {name:'AbortError'});
});

test('Auto launcher URLs round-trip destinations with queries, fragments, and custom relays', () => {
	const url='https://example.com/?a=1&b=2#section';
	const launcher=new URL(autoLauncherUrl(url,'auto','auto','wss://custom.test/'),'https://velora.test');
	assert.equal(launcher.pathname,'/api');
	assert.equal(launcher.searchParams.get('url'),url);
	assert.equal(launcher.searchParams.get('type'),'auto');
	assert.equal(launcher.searchParams.get('transport'),'auto');
	assert.equal(launcher.searchParams.get('wisp'),'wss://custom.test/');
});

test('closing before queued navigation runs never starts a late request', async () => {
	const {frame}=frameFixture(); const abort=new AbortController(); let navigations=0;
	const pending=waitForProxyDocument(frame,()=>{navigations++;},{signal:abort.signal});
	abort.abort();
	await assert.rejects(pending,{name:'AbortError'});
	await Promise.resolve();
	assert.equal(navigations,0);
});

test('an empty application shell is not mistaken for a usable document', async () => {
	const {frame,doc}=frameFixture();
	await assert.rejects(waitForProxyDocument(frame,()=>{frame.contentDocument=doc('Loading','script code');frame.contentDocument.body.innerText='';frame.dispatchEvent(new Event('load'));},{timeoutMs:5}), /did not start/);
});
