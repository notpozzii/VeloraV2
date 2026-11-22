import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIMARY_WISP, BACKUP_WISP, normalizeRelayUrl, resolveRelays } from '../src/lib/lethe/relay-config.js';
import { createRelayTransport, getRelayUrl, rememberRelayFailure } from '../src/lib/lethe/relay-fallback.js';
import { setCar } from '../src/lib/lethe/car.js';
import RelayTransport from '../src/lib/lethe/bare-relay-transport.js';
import { autoLauncherUrl, createAutoNavigator } from '../src/lib/lethe/auto.js';
import { getGeForceLauncherUrl } from '../src/lib/utils/browser/geforce.js';
import { createProxyRuntime } from '../src/lib/lethe/runtime.js';

const remote = new URL('https://example.test/');
test('relay choices validate WebSocket URLs and preserve ports, paths and query parameters', () => {
 assert.deepEqual(resolveRelays('', ''), { main: PRIMARY_WISP, backup: BACKUP_WISP });
 assert.equal(normalizeRelayUrl(' wss://CUSTOM.test:8443/wisp/?region=tx '), 'wss://custom.test:8443/wisp/?region=tx');
 assert.equal(normalizeRelayUrl('ws://localhost:4000/'), 'ws://localhost:4000/');
 for (const value of ['', null, {}, 'https://example.test/', 'javascript:alert(1)', 'wss://', 'wss://has space.test/', 'wss://name:secret@example.test/', 'wss://example.test/#fragment'])
  assert.equal(normalizeRelayUrl(value), null, String(value));
});

test('custom main fails over to the selected custom backup; changing backup starts a fresh pair', async () => {
 const main = 'wss://choice-main.test/', backup = 'wss://choice-backup.test/', other = 'wss://choice-other.test/';
 const used = [];
 const transport = createRelayTransport(wisp => ({
  async init() {},
  async request() { used.push(wisp); if (wisp === main) throw Error('Network connection failed'); return { status: 200 }; }
 }), main, { backupWisp: backup });
 await transport.request(remote, 'GET', null, []);
 assert.deepEqual(used, [main, backup]);
 assert.equal(getRelayUrl(main, backup), backup);
 assert.equal(getRelayUrl(main, other), main);
 assert.equal(getRelayUrl(main), main);
 assert.equal(rememberRelayFailure(main, backup), false);
});

test('choosing identical main and backup stops after one failed attempt', async () => {
 let calls = 0;
 const main = 'wss://same-relay.test/';
 const transport = createRelayTransport(() => ({
  async init() {}, async request() { calls++; throw Error('Network connection failed'); }
 }), main, { backupWisp: main });
 await assert.rejects(transport.request(remote, 'GET', null, []));
 assert.equal(calls, 1);
});

test('UV/SJ pass both custom choices into the worker, including page-selected failover', async () => {
 const main = 'wss://bare-main.test/', backup = 'wss://bare-backup.test/';
 rememberRelayFailure(main, backup);
 let config;
 await setCar({ async setTransport(path, [options]) { assert.equal(path, '/relay-transport.mjs'); config = options; } }, 'libcurlRaw', main, backup);
 assert.equal(config.wisp, main);
 assert.equal(config.backupWisp, backup);
 assert.equal(config.selectedWisp, backup);
 config.module = 'data:text/javascript,' + encodeURIComponent('export default class { constructor(options) { this.wisp = options.wisp; } async init() { this.ready = true; } async request() { return { status: 200, body: this.wisp }; } }');
 const worker = new RelayTransport(config);
 await worker.init();
 assert.equal((await worker.request(remote, 'GET', null, [])).body, backup);
});

test('GeForce and Auto launcher URLs carry both selected relay URLs intact', () => {
 const main = 'wss://relay.velora.uno/wisp/', backup = 'wss://mine.test:8443/wisp/?region=us&mode=fast';
 for (const url of [getGeForceLauncherUrl(main, undefined, backup), autoLauncherUrl('https://example.test/?a=1#x', 'auto', 'auto', main, backup)]) {
  const params = new URL(url, 'https://velora.test').searchParams;
  assert.equal(params.get('wisp'), main);
  assert.equal(params.get('backupWisp'), backup);
 }
});

test('changing only backup reconfigures SJ2 and UV while repeated choices reuse their transport', async () => {
 const calls = [];
 const dependencies = {
  async createPrismController() { return {}; },
  async setPrismTransport(car, main, backup, engine) { calls.push([engine, car, main, backup]); },
  async loadScript() {}, async registerProxyWorker() {}, createConnection() { return {}; },
  async setCar(_connection, ...args) { calls.push(['uv', ...args]); },
  async bindProxyTransport() {}
 };
 for (const engine of ['sj2', 'uv']) {
  const runtime = createProxyRuntime({ dependencies });
  await runtime.prepare(engine, 'libcurl', 'wss://main.test/', 'wss://one.test/');
  await runtime.prepare(engine, 'libcurl', 'wss://main.test/', 'wss://two.test/');
  await runtime.prepare(engine, 'libcurl', 'wss://main.test/', 'wss://two.test/');
 }
 assert.deepEqual(calls, ['sj2', 'uv'].flatMap(engine => [
  [engine, 'libcurl', 'wss://main.test/', 'wss://one.test/'],
  [engine, 'libcurl', 'wss://main.test/', 'wss://two.test/']
 ]));
});

test('Auto remembers working engines separately for each backup choice', async () => {
 const values = new Map(), attempts = [];
 const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
 const auto = createAutoNavigator({ storage, prepare: async (engine, car, main, backup) => { attempts.push([engine, backup]); return { engine }; } });
 const open = (backup, failSJ2 = false) => auto.open({
  url: 'https://example.test/', engine: 'auto', car: 'auto', wisp: 'wss://main.test/', backupWisp: backup,
  load: async session => { if (failSJ2 && session.engine === 'sj2') throw Error('Initial document failed'); }
 });
 await open('wss://one.test/', true);
 attempts.length = 0;
 await open('wss://one.test/');
 assert.deepEqual(attempts, [['uv', 'wss://one.test/']]);
 attempts.length = 0;
 await open('wss://two.test/');
 assert.deepEqual(attempts, [['sj2', 'wss://two.test/']]);
});
