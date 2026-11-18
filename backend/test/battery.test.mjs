import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/storage/store.mjs';
import { processReading, pushMessage } from '../src/services/notifications/alerts.mjs';
const device = { id: 'bin-battery', topic: 'smartbin/bin-battery', name: 'Thùng sân' };
const base = { schema: 1, device_id: device.id, battery_valid: true, battery_percent: 18, battery_low: true, battery_critical: false };

test('battery alerts deduplicate transitions, ignore retained/invalid samples and rearm after recovery', t => {
  const store = new Store(); t.after(() => store.close());
  store.register('installation-battery', 'ExpoPushToken[battery123]', [device]);
  const send = (changes = {}, retained = false) => processReading(store, device, JSON.stringify({ ...base, ...changes }), retained, 1000);
  send({}, true); send({ battery_valid: false }); send({ battery_percent: 101 });
  assert.equal(store.due(1000).length, 0);
  send(); send();
  assert.deepEqual(store.due(1000).map(job => job.kind), ['battery_low']);
  const lowJob = store.due(1000)[0];
  assert.equal(pushMessage(lowJob, 'token', 'broker').title, 'Pin thùng rác yếu');
  store.removeJob(lowJob.id);
  send({ battery_percent: 8, battery_critical: true }); send({ battery_percent: 8, battery_critical: true });
  assert.deepEqual(store.due(1000).map(job => job.kind), ['battery_critical']);
  assert.equal(pushMessage(store.due(1000)[0], 'token', 'broker').title, 'Pin thùng rác sắp hết');
  send({ battery_percent: 15 });
  assert.equal(store.due(1000).length, 0);
  send({ battery_percent: 30, battery_low: false }); send();
  assert.deepEqual(store.due(1000).map(job => job.kind), ['battery_low']);
});
test('first critical reading sends only the urgent battery alert', t => {
  const store = new Store(); t.after(() => store.close());
  store.register('installation-battery', 'ExpoPushToken[battery123]', [device]);
  processReading(store, device, JSON.stringify({ ...base, battery_percent: 5, battery_critical: true }), false, 1000);
  assert.deepEqual(store.due(1000).map(job => job.kind), ['battery_critical']);
});
