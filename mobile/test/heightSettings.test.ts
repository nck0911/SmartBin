import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeightRequests, heightCommand, parseHeight } from '../src/heightSettings.ts';
import { decode } from '../src/model.ts';

const data = { schema: 1 as const, device_id: 'a', fill_percent: 50, gas_adc: 1200, trash_valid: true, trash_stale: false, gas_valid: true, full: false, gas_high: false, lid_command: 'closed' as const, uptime_ms: 2000, configured: true, bin_height_cm: 45, settings_session: 123 };
const reading = { data: { ...data, configured: false, bin_height_cm: null, fill_percent: null }, receivedAt: 1000, liveAt: 1000 };
const response = (id = 'save_1', device = 'a', ok = true) => JSON.stringify({ device_id: device, request_id: id, height_mm: 450, ok, error: ok ? '' : 'storage' });

test('height input accepts centimetres and Vietnamese decimal separators, rejects invalid values', () => {
  assert.equal(parseHeight('45'), 450);
  assert.equal(parseHeight(' 45,5 '), 455);
  assert.equal(parseHeight('10.0'), 100);
  assert.equal(parseHeight('400'), 4000);
  for (const value of ['', '5', '9.9', '400.1', 'Infinity', 'NaN', '45cm', '45.55', '-45', '4e1']) assert.equal(parseHeight(value), null);
});

test('configured and unconfigured telemetry are validated; legacy telemetry remains readable', () => {
  assert.equal(decode(JSON.stringify(data), 'a')?.bin_height_cm, 45);
  const empty = { ...data, configured: false, bin_height_cm: null, fill_percent: null };
  assert.equal(decode(JSON.stringify(empty), 'a')?.configured, false);
  for (const malformed of [{ ...empty, full: true }, { ...empty, fill_percent: 0 }, { ...data, bin_height_cm: 5 }, { ...data, settings_session: 0 }, { ...data, configured: false }]) assert.equal(decode(JSON.stringify(malformed), 'a'), null);
  const { configured, bin_height_cm, settings_session, ...legacy } = data;
  assert.ok(decode(JSON.stringify(legacy), 'a'));
});

test('commands require fresh device data and contain a session, expiry and integer millimetres', () => {
  assert.equal(heightCommand('save_1', 450, reading, 2000), 'save_1:123:18000:450');
  assert.throws(() => heightCommand('save_1', 450, undefined, 2000));
  assert.throws(() => heightCommand('save_1', 450, { ...reading, liveAt: undefined }, 2000));
  assert.throws(() => heightCommand('save_1', 450, reading, 17000));
  assert.throws(() => heightCommand('save_1', 450, { ...reading, availability: 'offline' }, 2000));
  assert.throws(() => heightCommand('save_1', 50, reading, 2000));
  assert.equal(heightCommand('save_1', 450, { ...reading, data: { ...reading.data, uptime_ms: 0xffffffff - 5000 } }, 1000), 'save_1:123:9999:450');
});

test('broker publication alone cannot confirm a save; only the matching device result resolves it', async () => {
  const tracker = new HeightRequests();
  let completed = false;
  const pending = tracker.send('save_1', 'a', 450, callback => callback()).then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(tracker.receive('not JSON', 'a'), false);
  assert.equal(tracker.receive(response('other'), 'a'), false);
  assert.equal(tracker.receive(response('save_1', 'b'), 'a'), false);
  assert.equal(tracker.receive(response(), 'b'), false);
  assert.equal(tracker.receive(response().replace('450', '460'), 'a'), false);
  assert.equal(tracker.receive(response(), 'a'), true);
  await pending;
  assert.equal(completed, true);
  assert.equal(tracker.receive(response(), 'a'), false);
});

test('storage rejection, publishing failure, timeout and disconnect do not report success', async () => {
  const tracker = new HeightRequests(20);
  const storage = tracker.send('save_1', 'a', 450, () => {});
  const rejectedStorage = assert.rejects(storage, /không lưu được/);
  tracker.receive(response('save_1', 'a', false), 'a');
  await rejectedStorage;
  await assert.rejects(tracker.send('save_2', 'a', 450, callback => callback(new Error('offline'))), /Không gửi được/);
  await assert.rejects(tracker.send('save_3', 'a', 450, () => {}), /Chưa nhận được xác nhận/);
  const disconnected = tracker.send('save_4', 'a', 450, () => {});
  const rejectedDisconnect = assert.rejects(disconnected, /Kết nối đã thay đổi/);
  tracker.cancelAll();
  await rejectedDisconnect;
  assert.equal(tracker.receive(response('save_4'), 'a'), false);
});

test('a device cannot receive overlapping saves from the same app', async () => {
  const tracker = new HeightRequests();
  const first = tracker.send('save_1', 'a', 450, () => {});
  await assert.rejects(tracker.send('save_2', 'a', 460, () => {}), /Đang chờ/);
  tracker.receive(response(), 'a');
  await first;
});


test('preconfigured bins cannot be configured again and device rejection is shown clearly', async () => {
  assert.throws(() => heightCommand('save_1', 450, { ...reading, data }, 2000), /Không thể thiết lập lại/);
  const tracker = new HeightRequests();
  const pending = tracker.send('save_1', 'a', 450, () => {});
  const rejected = assert.rejects(pending, /Không thể thiết lập lại/);
  tracker.receive(JSON.stringify({ device_id: 'a', request_id: 'save_1', height_mm: 450, ok: false, error: 'already_configured' }), 'a');
  await rejected;
});
