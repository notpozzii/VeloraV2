import test from 'node:test';
import assert from 'node:assert/strict';
import localspace from 'localspace';
import { connectionDefaults, connectionResetKey, connectionResetVersion, createConnectionReset, isConnectionSetting } from '../src/lib/utils/connection-reset.js';

const sessionKey = `${connectionResetKey}:session`;
const autoKey = 'velora:auto-connections:v1';
function storage(entries = []) {
	const values = new Map(entries);
	return { values, getItem:key => values.get(key) ?? null, setItem:(key, value) => values.set(key, value), removeItem:key => values.delete(key) };
}
function fixture() {
	const data = new Map([['lethe', 'uv'], ['car', 'epoxy'], ['customWisp', 'wss://old.example/'], ['bookmarks', ['keep']], ['searchEngine', 'ddg'], ['theme', 'dark']]);
	const legacy = storage([['car', 'epoxy'], ['lethe', 'sj'], ['customWisp', 'wss://older.example/'], ['bookmarks', 'keep'], ['searchEngine', 'brave']]);
	const session = storage([[autoKey, 'old epoxy choice'], ['unrelated', 'keep']]);
	let queue = Promise.resolve(), transactions = 0, fail = false;
	const writes = [], notifications = [];
	const store = {
		runTransaction(mode, work) {
			assert.equal(mode, 'readwrite');
			transactions++;
			const job = queue.catch(() => {}).then(async () => {
				const next = new Map(data);
				const result = await work({
					get:async key => next.get(key) ?? null,
					set:async (key, value) => { if (fail && key === 'car') throw new Error('Quota exceeded'); writes.push(key); next.set(key, value); }
				});
				data.clear(); for (const [key, value] of next) data.set(key, value);
				return result;
			});
			queue = job; return job;
		}
	};
	const options = { store, legacyStorage:() => legacy, sessionStorage:() => session, notify:(...args) => notifications.push(args) };
	return { data, legacy, session, options, writes, notifications, store, get transactions() { return transactions; }, fail:() => { fail = true; } };
}

test('the release resets connections again after the previous migration and preserves unrelated settings', async () => {
	const f = fixture();
	f.data.set(connectionResetKey, '2026-10-29.1');
	f.session.setItem(sessionKey, '2026-10-29.1');
	assert.equal(await createConnectionReset(f.options).ensure(), true);
	for (const [key, value] of Object.entries(connectionDefaults)) {
		assert.equal(f.data.get(key), value); assert.equal(f.legacy.getItem(key), null);
	}
	assert.deepEqual(f.data.get('bookmarks'), ['keep']); assert.equal(f.data.get('searchEngine'), 'ddg'); assert.equal(f.data.get('theme'), 'dark');
	assert.equal(f.legacy.getItem('bookmarks'), 'keep'); assert.equal(f.legacy.getItem('searchEngine'), 'brave');
	assert.equal(f.data.get(connectionResetKey), connectionResetVersion);
	assert.deepEqual(f.notifications, Object.entries(connectionDefaults));
	assert.equal(f.session.getItem(autoKey), null); assert.equal(f.session.getItem('unrelated'), 'keep');
});

test('connection reads and writes share one migration rather than overwriting one another', async () => {
	const f = fixture(), reset = createConnectionReset(f.options);
	await Promise.all([reset.ensure(), reset.ensure(), reset.ensure(), reset.ensure()]);
	assert.equal(f.transactions, 1); assert.equal(f.writes.length, 4);
	assert.equal(isConnectionSetting('car'), true); assert.equal(isConnectionSetting('bookmarks'), false); assert.equal(isConnectionSetting('__proto__'), false);
});

test('later visits preserve choices made after this reset, including new Auto history', async () => {
	const f = fixture(); await createConnectionReset(f.options).ensure();
	f.data.set('lethe', 'auto'); f.data.set('car', 'epoxy'); f.data.set('customWisp', 'wss://new.example/');
	f.session.setItem(autoKey, 'new connection choice');
	const writes = f.writes.length;
	assert.equal(await createConnectionReset(f.options).ensure(), true);
	assert.equal(f.writes.length, writes); assert.equal(f.data.get('car'), 'epoxy'); assert.equal(f.data.get('lethe'), 'auto');
	assert.equal(f.data.get('customWisp'), 'wss://new.example/'); assert.equal(f.session.getItem(autoKey), 'new connection choice');
});

test('a second tab clears its old Auto history even if another tab already committed the reset', async () => {
	const f = fixture(); await createConnectionReset(f.options).ensure();
	const secondSession = storage([[autoKey, 'old epoxy choice']]);
	await createConnectionReset({ ...f.options, sessionStorage:() => secondSession }).ensure();
	assert.equal(secondSession.getItem(autoKey), null); assert.equal(secondSession.getItem(sessionKey), connectionResetVersion);
	assert.equal(f.writes.length, 4);
});

test('concurrent app frames and tabs commit one atomic reset', async () => {
	const f = fixture();
	await Promise.all([createConnectionReset(f.options).ensure(), createConnectionReset(f.options).ensure()]);
	assert.equal(f.writes.length, 4); assert.equal(f.notifications.length, 3);
});

test('failed storage does not stamp a completed reset or erase unrelated data', async () => {
	const f = fixture(); f.fail();
	assert.equal(await createConnectionReset(f.options).ensure(), false);
	assert.equal(f.data.get(connectionResetKey), undefined); assert.equal(f.data.get('car'), 'epoxy');
	assert.deepEqual(f.data.get('bookmarks'), ['keep']); assert.equal(f.notifications.length, 0);
});

test('a full site reset prevents migrations and session storage writes', async () => {
	const f = fixture();
	assert.equal(await createConnectionReset({ ...f.options, resetting:() => true }).ensure(), false);
	assert.equal(f.transactions, 0); assert.equal(f.session.getItem(autoKey), 'old epoxy choice');
	assert.equal(f.session.getItem(sessionKey), null);
});

test('unavailable browser storage and notification channels cannot prevent the defaults committing', async () => {
	const f = fixture();
	const denied = () => { throw new Error('Access denied'); };
	assert.equal(await createConnectionReset({ store:f.store, legacyStorage:denied, sessionStorage:denied, notify:denied, lock:work => work() }).ensure(), true);
	assert.equal(f.data.get('car'), 'libcurl');
});

test('the installed settings library supports this migration through its memory fallback', async () => {
	const store = localspace.createInstance({ name:'velora-connection-reset-test', storeName:'settings', driver:localspace.MEMORY });
	await store.setItem('car', 'epoxy'); await store.setItem('bookmarks', ['keep']);
	assert.equal(await createConnectionReset({ store }).ensure(), true);
	assert.equal(await store.getItem('car'), 'libcurl'); assert.deepEqual(await store.getItem('bookmarks'), ['keep']);
	await store.setItem('car', 'epoxy');
	assert.equal(await createConnectionReset({ store }).ensure(), true);
	assert.equal(await store.getItem('car'), 'epoxy');
	await store.clear();
});
