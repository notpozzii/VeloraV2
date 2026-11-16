import test from 'node:test';
import assert from 'node:assert/strict';
import localspace from 'localspace';
import { createRelayOrderMigration, normalizeRelayPreference } from '../src/lib/utils/relay-order.js';

let id = 0;
function fixture() {
	const store = localspace.createInstance({ name: `relay-order-${++id}`, storeName: 'settings', driver: localspace.MEMORY });
	const legacy = new Map(), session = new Map([['velora:auto-connections:v1', 'previous relay choice']]);
	const notices = [];
	const options = { store,
		legacyStorage: () => ({ getItem: key => legacy.get(key) ?? null, removeItem: key => legacy.delete(key) }),
		sessionStorage: () => ({ removeItem: key => session.delete(key) }),
		notify: (...args) => notices.push(args)
	};
	return { store, legacy, session, notices, options };
}

test('relay migration changes only the previous VPS preference and runs once', async () => {
	const f = fixture();
	await f.store.setItem('customWisp', 'wss://relay.velora.uno/wisp/');
	await f.store.setItem('lethe', 'sj'); await f.store.setItem('car', 'epoxy');
	await f.store.setItem('bookmarks', ['keep']);
	const migration = createRelayOrderMigration(f.options);
	assert.equal(await migration.ensure(), true);
	assert.equal(await f.store.getItem('customWisp'), '');
	assert.equal(await f.store.getItem('lethe'), 'sj'); assert.equal(await f.store.getItem('car'), 'epoxy');
	assert.deepEqual(await f.store.getItem('bookmarks'), ['keep']);
	assert.deepEqual(f.notices, [['customWisp', '']]);
	assert.equal(f.session.has('velora:auto-connections:v1'), false);
	await f.store.setItem('customWisp', 'wss://relay.velora.uno/wisp/');
	await createRelayOrderMigration(f.options).ensure();
	assert.equal(await f.store.getItem('customWisp'), 'wss://relay.velora.uno/wisp/');
	await f.store.clear();
});

test('legacy IP-based VPS preferences migrate, but unrelated custom relays are preserved', async () => {
	const legacy = fixture(); legacy.legacy.set('customWisp', 'wss://216.128.143.160/wisp/');
	await createRelayOrderMigration(legacy.options).ensure();
	assert.equal(await legacy.store.getItem('customWisp'), '');
	assert.equal(legacy.legacy.has('customWisp'), false);
	await legacy.store.clear();
	const custom = fixture(); await custom.store.setItem('customWisp', 'wss://my-relay.example/wisp/');
	await createRelayOrderMigration(custom.options).ensure();
	assert.equal(await custom.store.getItem('customWisp'), 'wss://my-relay.example/wisp/');
	assert.equal(custom.notices.length, 0);
	await custom.store.clear();
});

test('a full reset prevents relay migration from writing data', async () => {
	const f = fixture(); await f.store.setItem('customWisp', 'wss://relay.velora.uno/wisp/');
	assert.equal(await createRelayOrderMigration({ ...f.options, resetting: () => true }).ensure(), false);
	assert.equal(await f.store.getItem('customWisp'), 'wss://relay.velora.uno/wisp/');
	assert.equal(f.notices.length, 0);
	await f.store.clear();
});

test('only the known old endpoint is normalized in saved launcher URLs', () => {
	assert.equal(normalizeRelayPreference('wss://relay.velora.uno/wisp'), '');
	assert.equal(normalizeRelayPreference('wss://216.128.143.160/wisp/'), '');
	assert.equal(normalizeRelayPreference('wss://galxy.it.com/jsonn/'), 'wss://galxy.it.com/jsonn/');
	assert.equal(normalizeRelayPreference('wss://relay.velora.uno:444/wisp/'), 'wss://relay.velora.uno:444/wisp/');
	assert.equal(normalizeRelayPreference('wss://relay.velora.uno.attacker.test/wisp/'), 'wss://relay.velora.uno.attacker.test/wisp/');
});
