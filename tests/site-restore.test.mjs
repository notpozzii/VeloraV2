import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resetInProgress } from '../src/lib/utils/reset-core.js';
import * as restore from '../src/lib/utils/restore-core.js';
const { restoreDatabases } = await import(new URL('./storage/indexeddb.js', import.meta.resolve('origin-snapshot')));
const { restoreWebStorage } = await import(new URL('./storage/webstorage.js', import.meta.resolve('origin-snapshot')));
const id = '24b21ac4-d98d-451b-ad11-bb9b100aa000';
const manifest = { format: 'origin-snapshot', version: 1, sections: { indexedDB: [] } };

function storage(initial = {}, events = []) {
	const map = new Map(Object.entries(initial));
	return {
		get length() { return map.size; }, key: index => [...map.keys()][index] ?? null,
		getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)),
		removeItem(key) { events.push(`remove:${key}`); map.delete(key); }, clear() { events.push('clear'); map.clear(); }
	};
}
function fakeHost() {
	const events = [], listeners = new Map(), channels = [], records = new Map();
	const host = {
		localStorage: storage({ notes: 'current notes' }, events), sessionStorage: storage(),
		crypto: { randomUUID: () => id },
		location: { origin: 'https://velora.test', pathname: '/os', replace: url => events.push(`navigate:${url}`) },
		navigator: { serviceWorker: { getRegistrations: async () => [] } },
		document: { documentElement: {}, querySelectorAll: () => [{ remove: () => events.push('frame:remove') }] },
		stop: () => events.push('stop'), addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
		BroadcastChannel: class { constructor() { channels.push(this); } close() { events.push('channel:close'); } },
		indexedDB: {
			async databases() { return [{ name: 'galaxy' }, { name: '__op' }, { name: restore.restoreStagingDatabase }]; },
			open(name) {
				assert.equal(name, restore.restoreStagingDatabase, 'staging never opens a user database');
				const request = {};
				queueMicrotask(() => {
					request.result = {
						close: () => events.push('staging:close'),
						transaction() {
							const transaction = {};
							const complete = () => queueMicrotask(() => transaction.oncomplete?.());
							transaction.objectStore = () => ({
								clear() { records.clear(); },
								put(record) { records.set(record.id, record); complete(); },
								delete(key) { records.delete(key); events.push('staging:remove'); complete(); },
								get(key) { const read = {}; queueMicrotask(() => { read.result = records.get(key); read.onsuccess(); complete(); }); return read; }
							});
							return transaction;
						}
					}; request.onsuccess();
				}); return request;
			}
		}
	}; host.parent = host;
	return { host, events, listeners, channels, records };
}

test('restore is staged before navigation without clearing active user storage', async () => {
	const { host, events, records } = fakeHost();
	const file = new Blob(['backup']);
	const intent = await restore.beginSiteRestore(host, file, manifest);
	assert.equal(intent.id, id);
	assert.equal(records.get(id).file, file);
	assert.equal(host.localStorage.getItem('notes'), 'current notes');
	assert.equal(restore.readRestoreMarker(host), null);
	assert.equal(restore.readRestoreIntent(host, id).returnTo, '/os');
	assert.ok(events.at(-1).startsWith('navigate:https://velora.test/restore.html?'));
	assert.equal(events.includes('clear'), false);
	assert.ok(events.indexOf('staging:close') < events.findIndex(event => event.startsWith('navigate:')));
});

test('invalid or unfinished snapshots never stage a restore, and intent cannot redirect off origin', async () => {
	const { host, events, records } = fakeHost();
	await assert.rejects(restore.beginSiteRestore(host, new Blob(), { ...manifest, format: 'wrong' }), /supported/);
	await assert.rejects(restore.beginSiteRestore(host, new Blob(), { ...manifest, sections: { indexedDB: [{ name: restore.restoreStagingDatabase }] } }), /unfinished/);
	assert.equal(events.length, 0); assert.equal(records.size, 0);
	host.sessionStorage.setItem(restore.restoreIntentKey, JSON.stringify({ id, time: 1000, returnTo: 'https://evil.test' }));
	assert.equal(restore.readRestoreIntent(host, id, 1001).returnTo, '/');
	assert.equal(restore.readRestoreIntent(host, id, 301001), null);
	assert.equal(restore.readRestoreIntent(host, 'another-id-00000000000000', 1001), null);
	assert.equal(new URL(restore.restorePageUrl(host, id, '//evil.test')).origin, host.location.origin);
});

test('the coordinator unloads apps and pauses stale writers only for a real restore marker', () => {
	const { host, events, channels, listeners } = fakeHost();
	const coordinator = restore.installRestoreCoordinator(host);
	channels[0].onmessage({ data: { type: 'start', id } });
	assert.equal(coordinator.holding, false);
	host.localStorage.setItem(restore.restoreStorageKey, JSON.stringify({ id, returnTo: '/os' }));
	listeners.get('storage')({ key: restore.restoreStorageKey });
	assert.equal(coordinator.holding, true);
	assert.equal(resetInProgress(host), true);
	assert.ok(events.includes('frame:remove'));
	assert.ok(events.some(event => event.includes('phase=wait')));
	assert.equal(host.localStorage.getItem('notes'), 'current notes');
	host.localStorage.removeItem(restore.restoreStorageKey);
	assert.equal(resetInProgress(host), true, 'the old context cannot write after restore finishes');
	coordinator.dispose(); assert.equal(listeners.has('storage'), false);
});

test('backup exports omit the internal staging database', async () => {
	const { host } = fakeHost();
	assert.deepEqual(await restore.exportDatabaseNames(host), ['galaxy', '__op']);
});

test('successful restore keeps its pause marker until data import and staging cleanup complete', async () => {
	const { host, events, records } = fakeHost();
	const record = { id, file: new Blob(['backup']) }; records.set(id, record);
	host.localStorage.setItem(restore.restoreStorageKey, JSON.stringify({ id, returnTo: '/os' }));
	await restore.applyStagedRestore(host, record, async (file, options) => {
		assert.equal(file, record.file);
		assert.ok(options.preserveStorageKeys.includes(restore.restoreStorageKey));
		assert.equal(restore.readRestoreMarker(host).id, id);
		events.push('import:done');
	});
	assert.ok(events.indexOf('import:done') < events.indexOf('staging:remove'));
	assert.ok(events.indexOf('staging:remove') < events.indexOf(`remove:${restore.restoreStorageKey}`));
	assert.equal(restore.readRestoreMarker(host), null);
	assert.equal(records.size, 0);
});

test('failed imports retain their backup and keep apps paused for retry', async () => {
	const { host, records } = fakeHost();
	const record = { id, file: new Blob(['backup']) }; records.set(id, record);
	host.localStorage.setItem(restore.restoreStorageKey, JSON.stringify({ id, returnTo: '/os' }));
	await assert.rejects(restore.applyStagedRestore(host, record, async () => { throw new Error('write failed'); }), /write failed/);
	assert.equal(restore.readRestoreMarker(host).id, id);
	assert.equal(records.get(id), record);
	assert.equal(resetInProgress(host), true);
});

test('blocked database deletion waits and then restores instead of rejecting with a deletion still queued', async () => {
	const previous = globalThis.indexedDB;
	let deletion, opened = false, closed = false, blockedName;
	globalThis.indexedDB = {
		deleteDatabase() { deletion = {}; queueMicrotask(() => deletion.onblocked()); return deletion; },
		open() { opened = true; const request = {}; queueMicrotask(() => { request.result = { close: () => { closed = true; } }; request.onsuccess(); }); return request; }
	};
	try {
		let settled = false;
		const result = restoreDatabases([{ name: '__op', version: 1, stores: [] }], [], { onblocked: name => { blockedName = name; } });
		result.then(() => { settled = true; }, () => { settled = true; });
		await Promise.resolve(); await Promise.resolve();
		assert.equal(blockedName, '__op'); assert.equal(settled, false); assert.equal(opened, false);
		deletion.onsuccess(); await result;
		assert.equal(opened, true); assert.equal(closed, true);
	} finally { globalThis.indexedDB = previous; }
});

test('restoring web storage preserves operation markers and ignores marker values from a backup', () => {
	const values = storage({ [restore.restoreStorageKey]: 'active-id', old: 'remove' });
	restoreWebStorage(values, { [restore.restoreStorageKey]: 'untrusted-backup-id', restored: 'yes' }, { clear: true, preserveKeys: [restore.restoreStorageKey] });
	assert.equal(values.getItem(restore.restoreStorageKey), 'active-id');
	assert.equal(values.getItem('old'), null); assert.equal(values.getItem('restored'), 'yes');
});

test('the restore screen and its script are published separately from the desktop', () => {
	const page = readFileSync(new URL('../static/restore.html', import.meta.url), 'utf8');
	assert.ok(page.includes('src="/site-restore.js"'));
	assert.ok(!page.includes('_app/'));
	assert.ok(readFileSync(new URL('../static/site-restore.js', import.meta.url), 'utf8').includes('velora-restore-staging'));
});

test('a waiting page releases its old worker even if it missed the leader reload message', async () => {
	const { host, events } = fakeHost();
	host.location.search = `?id=${id}&return=%2Fos&phase=wait`;
	host.navigator.serviceWorker.controller = { scriptURL: '/old-worker.js' };
	host.localStorage.setItem(restore.restoreStorageKey, JSON.stringify({ id, returnTo: '/os' }));
	const nodes = new Map();
	const source = readFileSync(new URL('../src/lib/utils/restore-page.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
	vm.runInNewContext(source, {
		...restore, URL, URLSearchParams, window: host,
		document: { getElementById(name) { if (!nodes.has(name)) nodes.set(name, {}); return nodes.get(name); } },
		unregisterSiteWorkers: async () => { events.push('worker:release'); }
	});
	await Promise.resolve(); await Promise.resolve();
	assert.ok(events.includes('worker:release'));
	assert.ok(events.some(event => event.startsWith('navigate:') && event.includes('phase=wait') && event.includes('released=1')));
});
