import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AlertTracker, alertData, registerPush, serverUrl } from '../src/notificationModel.ts';
import type { Bin, Reading } from '../src/model.ts';
import { ALERT_CHANNEL_ID, createChannelInitializer, notificationChannelId } from '../src/notificationChannel.ts';

const bin: Bin = { id: 'a', topic: 'test/a', name: 'Thùng bếp', location: 'Bếp' };
const broker = 'wss://mqtt.example.test/mqtt';
const data = { schema: 1 as const, device_id: 'a', configured: true, bin_height_cm: 45, settings_session: 1, fill_percent: 85, gas_adc: 2300, trash_valid: true, trash_stale: false, gas_valid: true, full: true, gas_high: true, lid_command: 'closed' as const, uptime_ms: 1000 };
function reading(at: number, changes = {}): Reading { return { data: { ...data, ...changes }, liveAt: at, receivedAt: at, availability: 'online' }; }

test('local notifications fire once per alarm transition, not every MQTT packet', () => {
  const tracker = new AlertTracker();
  const events = tracker.observe(bin, reading(1000), broker, false, 1000);
  assert.equal(events.length, 2);
  assert.equal(events[1].title, 'Thùng rác có mùi hôi');
  assert.equal(tracker.observe(bin, reading(3000), broker, false, 3000).length, 0);
  tracker.observe(bin, reading(4000, { full: false, gas_high: false }), broker, false, 4000);
  assert.equal(tracker.observe(bin, reading(5000), broker, false, 5000).length, 2);
});
test('retained-only, expired and offline readings do not trigger or clear alarms', () => {
  const tracker = new AlertTracker();
  assert.equal(tracker.observe(bin, { ...reading(1000), liveAt: undefined }, broker, false, 1000).length, 0);
  assert.equal(tracker.observe(bin, reading(1000), broker, false, 17000).length, 0);
  assert.equal(tracker.observe(bin, { ...reading(1000), availability: 'offline' }, broker, false, 1000).length, 0);
  assert.equal(tracker.observe(bin, reading(18000), broker, false, 18000).length, 2);
  tracker.observe(bin, reading(19000, { full: false, trash_stale: true, gas_high: false, gas_valid: false }), broker, false, 19000);
  assert.equal(tracker.observe(bin, reading(20000), broker, false, 20000).length, 0);
});
test('demo alerts are labeled and independent from live MQTT alarms', () => {
  const tracker = new AlertTracker();
  const demo = tracker.observe(bin, reading(1000), broker, true, 1000);
  assert.ok(demo.every(event => event.title.startsWith('Thử · ') && event.data.demo));
  assert.equal(tracker.observe(bin, reading(2000), broker, false, 2000).length, 2);
  assert.equal(tracker.observe(bin, reading(3000, { configured: false, fill_percent: null }), 'other', false, 3000).length, 1);
});
test('notification taps require a valid bin target and a broker identity', () => {
  const event = new AlertTracker().observe(bin, reading(1000), broker, false, 1000)[0];
  assert.equal(alertData(event.data)?.binId, bin.id);
  assert.equal(alertData({ ...event.data, brokerUrl: undefined }), null);
  assert.equal(alertData({ ...event.data, kind: 'unknown' }), null);
  assert.equal(alertData(null), null);
});
test('service endpoints use HTTPS and reject embedded credentials', () => {
  assert.equal(serverUrl(' https://notify.example.test/ '), 'https://notify.example.test');
  for (const invalid of ['http://host', 'https://u:p@host', 'https://host?key=1', 'https://host#hash', 'invalid']) assert.throws(() => serverUrl(invalid));
});
test('push enrollment excludes demo bins, checks acknowledgement and handles credential errors', async () => {
  const settings = { mode: 'off' as const, serverUrl: 'https://notify.example.test', installationId: 'installation_12345678', targets: [] };
  const secret = 'a'.repeat(64);
  const fetcher: typeof fetch = async (_input, init) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer pairing-code');
    const body = JSON.parse(init?.body as string);
    assert.equal(body.bins.length, 1); assert.equal(body.brokerUrl, broker);
    return new Response(JSON.stringify({ ok: true, secret, bins: [bin] }));
  };
  assert.equal((await registerPush(settings, 'pairing-code', 'ExpoPushToken[test]', [bin, { ...bin, id: 'demo-123' }], broker, fetcher)).secret, secret);
  await assert.rejects(registerPush(settings, 'bad', 'token', [bin], broker, async () => new Response('{}', { status: 401 })), /Mã kết nối/);
  await assert.rejects(registerPush(settings, 'code', 'token', [bin], broker, async () => new Response('{}')), /không hợp lệ/);
});

test('Android channel uses platform audio defaults and initializes once for concurrent callers', async () => {
  const initialize = createChannelInitializer();
  let calls = 0;
  const api = {
    AndroidImportance: { HIGH: 6 },
    async setNotificationChannelAsync(id: string, options: Record<string, unknown>) {
      calls++;
      assert.equal(id, ALERT_CHANNEL_ID);
      assert.equal(options.importance, 6);
      assert.equal('sound' in options, false);
      assert.equal('audioAttributes' in options, false);
      assert.equal('vibrationPattern' in options, false);
      return { id };
    },
  };
  await Promise.all([initialize(api), initialize(api)]);
  await initialize(api);
  assert.equal(calls, 1);
});

test('Expo Go routes immediate notifications to the native default channel, not the failing custom bridge', () => {
  assert.equal(notificationChannelId('android', 35, true), null);
  assert.equal(notificationChannelId('android', 35, false), ALERT_CHANNEL_ID);
  assert.equal(notificationChannelId('android', 25, false), null);
  assert.equal(notificationChannelId('ios', 18, false), null);
});

test('a rejected or missing native channel is not cached as success and can be retried', async () => {
  const initialize = createChannelInitializer();
  let calls = 0;
  const api = {
    AndroidImportance: { HIGH: 6 },
    async setNotificationChannelAsync() {
      calls++;
      if (calls === 1) throw new Error('native NullPointerException');
      if (calls === 2) return null;
      return { id: ALERT_CHANNEL_ID };
    },
  };
  await assert.rejects(initialize(api), /NullPointerException/);
  await assert.rejects(initialize(api), /không trả về/);
  await initialize(api);
  assert.equal(calls, 3);
});
