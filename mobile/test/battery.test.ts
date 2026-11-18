import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batteryStatus } from '../src/battery.ts';
import { decode } from '../src/model.ts';
import { alertData } from '../src/notificationModel.ts';
const telemetry = { schema: 1, device_id: 'a', lid_command: 'closed', uptime_ms: 1000, fill_percent: null, gas_adc: 1200, trash_valid: false, trash_stale: true, gas_valid: true, full: false, gas_high: false };
const battery = { battery_percent: 18, battery_valid: true, battery_low: true, battery_critical: false };

test('battery telemetry is optional but rejects malformed percentages and flags', () => {
  assert.ok(decode(JSON.stringify(telemetry), 'a'));
  assert.ok(decode(JSON.stringify({ ...telemetry, ...battery }), 'a'));
  for (const changes of [{ battery_percent: -1 }, { battery_percent: 101 }, { battery_percent: '18' }, { battery_percent: 18.5 }, { battery_valid: 'true' }, { battery_low: false, battery_critical: true }]) {
    assert.equal(decode(JSON.stringify({ ...telemetry, ...battery, ...changes }), 'a'), null);
  }
});
test('dashboard shows battery only from live device telemetry and keeps 0% valid', () => {
  const data = decode(JSON.stringify({ ...telemetry, ...battery }), 'a')!;
  const reading = { data, liveAt: 1000, receivedAt: 1000, availability: 'online' };
  assert.deepEqual(batteryStatus(reading, true, 2000), { percent: 18, level: 'low' });
  assert.deepEqual(batteryStatus({ ...reading, data: { ...data, battery_percent: 0, battery_critical: true } }, true, 2000), { percent: 0, level: 'critical' });
  for (const [percent, level] of [[1, 'critical'], [9, 'critical'], [10, 'low'], [20, 'low'], [21, 'normal']] as const) {
    assert.deepEqual(batteryStatus({ ...reading, data: { ...data, battery_percent: percent, battery_low: true, battery_critical: true } }, true, 2000), { percent, level });
  }
  for (const unavailable of [undefined, { data }, { ...reading, availability: 'offline' }, { ...reading, data: { ...data, battery_valid: false, battery_percent: null } }]) {
    assert.equal(batteryStatus(unavailable, true, 2000).percent, null);
  }
  assert.equal(batteryStatus(reading, false, 2000).percent, null);
  assert.equal(batteryStatus(reading, true, 17000).percent, null);
});
test('battery alert taps use the same target validation as other alerts', () => {
  for (const kind of ['battery_low', 'battery_critical']) {
    assert.ok(alertData({ type: 'smartbin-alert', binId: 'a', topic: 'bins/a', brokerUrl: 'wss://example.test', eventId: kind, demo: false, kind }));
  }
});
