import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlace, allowedRobloxUrl, createRobloxNetwork, gameAddress } from '../src/lib/roblox/network.js';

const reply = (status, json, headers = {}) => ({ status, headers: { 'content-type': 'application/json', ...headers }, body: new TextEncoder().encode(JSON.stringify(json)) });
function controller(request) {
  return { loadSavedCookies: async () => {}, cookieJar: { getCookies: () => '', setCookies() {} }, persistCookies: async () => {}, transport: { request } };
}

test('game input and network destinations reject lookalike hosts and unsafe URLs', () => {
  assert.equal(parsePlace('https://www.roblox.com/games/1818/Crossroads'), '1818');
  assert.equal(parsePlace(' 1818 '), '1818');
  for (const value of ['javascript:alert(1)', 'https://roblox.com.evil.test/games/1818', 'https://example.com/games/1818', '9007199254740992']) assert.equal(parsePlace(value), null);
  for (const url of ['http://www.roblox.com/', 'https://roblox.com.evil.test/', 'https://token@www.roblox.com/', 'https://www.roblox.com:8443/', 'https://127.0.0.1/']) assert.throws(() => allowedRobloxUrl(url));
});

test('join address accepts both server token formats and rejects malformed routing', () => {
  const script = { UdmuxEndpoints: [{ Address: '128.116.0.20' }], MachineAddress: '10.1.2.3', NetStackPort: 40000, NetStackTokenValue: '0123456789abcdef0123456789abcdef' };
  assert.equal(gameAddress(script), '0123456789abcdef0123456789abcdef-0a010203-9c40.80740015.qdmux.roblox.com');
  assert.equal(gameAddress({ ...script, NetStackTokenValue: btoa(String.fromCharCode(...Array.from({ length: 16 }, (_, i) => i))) }), '000102030405060708090a0b0c0d0e0f-0a010203-9c40.80740015.qdmux.roblox.com');
  assert.equal(gameAddress({ ...script, NetStackTokenValue: 'not a session token' }), null);
  assert.equal(gameAddress({ ...script, UdmuxEndpoints: [{ Address: '128.116.0.255' }] }), null);
});

test('a CSRF refresh retries the same join once and preserves a server denial', async () => {
  const calls = [];
  const network = createRobloxNetwork(controller(async (url, method, body, headers) => {
    assert.ok(Array.isArray(headers), 'Prism transports accept an iterable of header pairs');
    calls.push({ url: url.href, method, body, headers: Object.fromEntries(headers) });
    return calls.length === 1 ? reply(403, {}, { 'x-csrf-token': 'synthetic-test-csrf' }) : reply(200, { status: 6, message: 'Cannot join this game' });
  }));
	const result = await network.request('https://gamejoin.roblox.com/v1/join-game', { method: 'POST', headers: { 'User-Agent': 'engine-agent', 'Rbx-User-Agent': 'Roblox/Web', Requester: 'engine', Origin: 'https://engine.test' }, body: new TextEncoder().encode('{"placeId":1818}') });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers['x-csrf-token'], 'synthetic-test-csrf');
  assert.equal(calls[1].headers['user-agent'], 'Roblox/WinInet');
  assert.equal(calls[1].headers['rbx-user-agent'], 'Roblox/Darwin');
  assert.equal(calls[1].headers.requester, 'Client');
  assert.equal(calls[1].headers.origin, 'https://play.roblox.com');
  assert.equal(new Set(Object.keys(calls[1].headers).map(key => key.toLowerCase())).size, Object.keys(calls[1].headers).length);
  assert.equal(calls[1].body, calls[0].body);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(result.body)), { status: 6, message: 'Cannot join this game' });
  network.dispose();
  await assert.rejects(network.request('https://users.roblox.com/v1/users/authenticated'), /closed/);
});

test('a redirect cannot forward the account session to another service', async () => {
  let count = 0;
  const network = createRobloxNetwork(controller(async () => { count++; return reply(302, {}, { location: 'https://example.com/collect' }); }));
  await assert.rejects(network.request('https://www.roblox.com/'), /unsupported server/);
  assert.equal(count, 1);
  network.dispose();
});

test('reserved-server transfers receive the join adapter while ordinary API requests keep their identity', async () => {
  const seen = [];
  const network = createRobloxNetwork(controller(async (url, method, body, headers) => {
    seen.push(Object.fromEntries(headers));
    return reply(200, { status: 12, message: 'Not authorized' });
  }));
  const init = { method: 'POST', headers: { 'Rbx-User-Agent': 'Roblox/Web' }, body: '{}' };
  const denied = await network.request('https://gamejoin.roblox.com/v1/join-reserved-game', init);
  await network.request('https://users.roblox.com/v1/users/authenticated', { headers: init.headers });
  assert.equal(seen[0]['rbx-user-agent'], 'Roblox/Darwin');
  assert.equal(seen[1]['rbx-user-agent'], 'Roblox/Web');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(denied.body)), { status: 12, message: 'Not authorized' });
  network.dispose();
});

test('session rotation is persisted from raw headers before a CSRF retry', async () => {
  let cookie = 'test_session=old';
  let persisted = 0;
  let calls = 0;
  const c = controller(async (url, method, body, headers) => {
    calls++;
    if (calls === 1) return { status: 403, headers: [['x-csrf-token', 'test-csrf'], ['set-cookie', 'test_session=rotated; Path=/; Secure; HttpOnly']], body: new Uint8Array() };
    assert.equal(Object.fromEntries(headers).cookie, 'test_session=rotated');
    return reply(200, {});
  });
  c.cookieJar.getCookies = () => cookie;
  c.cookieJar.setCookies = value => { cookie = value.split(';')[0]; };
  c.persistCookies = async () => { persisted++; };
  const network = createRobloxNetwork(c);
  await network.request('https://gamejoin.roblox.com/v1/join-game', { method: 'POST' });
  assert.equal(persisted, 1);
  assert.equal(calls, 2);
  network.dispose();
});
