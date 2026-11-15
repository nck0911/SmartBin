import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../src/storage/store.mjs';
import { processReading } from '../src/services/notifications/alerts.mjs';
import { deliver } from '../src/services/notifications/delivery.mjs';
import { ExpoSender } from '../src/integrations/expoPush.mjs';
import { createHandler } from '../src/http/handler.mjs';

const device = { id: 'bin-a', topic: 'test/bin-a', name: 'Thùng phòng bếp' };
const token = 'ExpoPushToken[12345678abcd]';
const install = 'installation_12345678';
const broker = 'wss://mqtt.example.test/mqtt';
const reading = { schema: 1, device_id: device.id, configured: true, fill_percent: 85, full: true, trash_valid: true, trash_stale: false, gas_valid: true, gas_adc: 2300, gas_high: true };
function send(store, changes = {}, retained = false, now = 1000) { processReading(store, device, JSON.stringify({ ...reading, ...changes }), retained, now); }
function subscribed(store) { return store.register(install, token, [device]); }

test('state and events snapshots do not repeat alerts every two seconds', t => {
  const store = new Store(); t.after(() => store.close()); subscribed(store);
  send(store); send(store, {}, false, 3000); send(store, {}, false, 5000);
  assert.equal(store.due(5000).length, 2);
  assert.deepEqual(new Set(store.due(5000).map(j => j.kind)), new Set(['full', 'odor']));
  send(store, { full: false, gas_high: false }, false, 6000);
  assert.equal(store.due(6000).length, 0); // Do not send a queued warning after recovery.
  send(store, {}, false, 7000);
  assert.equal(store.due(7000).length, 2);
});
test('retained, invalid, wrong-device and stale samples never create or rearm false alarms', t => {
  const store = new Store(); t.after(() => store.close()); subscribed(store);
  send(store, {}, true); send(store, { device_id: 'other' });
  processReading(store, device, 'broken JSON', false);
  assert.equal(store.due(1000).length, 0);
  send(store); const originalIds = store.due(1000).map(j => j.id);
  send(store, { full: false, trash_stale: true, gas_high: false, gas_valid: false }); send(store);
  assert.deepEqual(store.due(1000).map(j => j.id), originalIds);
});
test('unconfigured height can still produce an odor warning independently', t => {
  const store = new Store(); t.after(() => store.close()); subscribed(store);
  send(store, { configured: false, fill_percent: null });
  assert.deepEqual(store.due(1000).map(j => j.kind), ['odor']);
});
test('registrations, deduplication and outbox survive a process restart', () => {
  mkdirSync('data', { recursive: true });
  const filename = resolve('data', `test-${randomUUID()}.sqlite`);
  try {
    const first = new Store(filename); const secret = subscribed(first); send(first); first.close();
    const second = new Store(filename);
    try {
      assert.equal(second.authorize(install, secret), true);
      send(second);
      assert.equal(second.due(1000).length, 2);
    } finally { second.close(); }
  } finally { for (const suffix of ['', '-wal', '-shm']) if (existsSync(filename + suffix)) unlinkSync(filename + suffix); }
});
test('worker retries temporary failure and preserves a ticket until its receipt is checked', async t => {
  const store = new Store(':memory:', broker); t.after(() => store.close()); subscribed(store); send(store, { gas_high: false });
  let attempts = 0;
  const sender = {
    async send(message) { attempts++; assert.equal(message.data.brokerUrl, broker); if (attempts === 1) throw Error('temporary'); return { status: 'ok', id: 'ticket-1' }; },
    async receipt() { return { status: 'ok' }; },
  };
  await deliver(store, sender, 1000); assert.equal(store.due(1000).length, 0);
  await deliver(store, sender, 3000); assert.equal(attempts, 2);
  assert.equal(store.due(3000).length, 0);
  await deliver(store, sender, 903000);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n, 0);
});
test('invalid receipt retires only its token, not a replacement token', async t => {
  const store = new Store(); t.after(() => store.close()); const secret = subscribed(store); send(store, { gas_high: false });
  const sender = { async send() { return { status: 'ok', id: 'ticket-1' }; }, async receipt() { return { status: 'error', details: { error: 'DeviceNotRegistered' } }; } };
  await deliver(store, sender, 1000);
  store.register(install, 'ExpoPushToken[newToken1234]', [device], secret);
  await deliver(store, sender, 901000);
  assert.equal(store.get(install).token, 'ExpoPushToken[newToken1234]');
});
test('unregistered tokens and disabling a registration remove pending jobs', async t => {
  const store = new Store(); t.after(() => store.close()); subscribed(store); send(store);
  await deliver(store, { async send() { return { status: 'error', details: { error: 'DeviceNotRegistered' } }; } }, 1000);
  assert.equal(store.get(install), undefined); assert.equal(store.due(1000).length, 0);
  subscribed(store); send(store, { full: false, gas_high: false }); send(store);
  store.remove(install); assert.equal(store.due(1000).length, 0);
});
test('Expo HTTP errors and malformed responses are not treated as accepted tickets', async () => {
  const badHttp = new ExpoSender(undefined, async () => ({ ok: false, status: 503 }));
  await assert.rejects(badHttp.send({}), /HTTP 503/);
  const badBody = new ExpoSender(undefined, async () => ({ ok: true, json: async () => ({ data: [] }) }));
  await assert.rejects(badBody.send({}), /Missing push ticket/);
});
test('HTTP registration requires authorization, restricts devices, supports rotation and revocation', async t => {
  const store = new Store(); t.after(() => store.close());
  const pairingCode = 'test-pairing-code-123456';
  const server = createServer(createHandler({ store, pairingCode, devices: [device], appBrokerUrl: broker }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/v1/registrations/${install}`;
  const body = { brokerUrl: broker, token, bins: [device] };
  const request = (credential, content = body, method = 'PUT') => fetch(url, { method, headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' }, ...(method === 'PUT' ? { body: JSON.stringify(content) } : {}) });
  assert.equal((await request('wrong')).status, 401);
  assert.equal((await request(pairingCode, { ...body, brokerUrl: 'other' })).status, 409);
  assert.equal((await request(pairingCode, { ...body, bins: [{ ...device, topic: 'other/#' }] })).status, 400);
  const registered = await (await request(pairingCode)).json();
  assert.equal(registered.ok, true); assert.equal(registered.secret.length, 64);
  assert.equal((await request(registered.secret)).status, 200);
  const recovered = await (await request(pairingCode)).json();
  assert.notEqual(recovered.secret, registered.secret);
  assert.equal((await request(registered.secret)).status, 401);
  send(store);
  assert.equal((await request(recovered.secret, undefined, 'DELETE')).status, 200);
  assert.equal(store.due(1000).length, 0);
});
