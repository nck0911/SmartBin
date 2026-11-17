import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBinQr } from '../src/binQr.ts';
import { initialBin } from '../src/model.ts';

const payload = { type: 'smart-trash-bin', version: 1, ...initialBin };
test('QR contains the firmware identity and topic', () => {
  assert.deepEqual(parseBinQr(JSON.stringify(payload)), initialBin);
  const first = parseBinQr(readFileSync(new URL('../../docs/qr/bin-1.json', import.meta.url), 'utf8'));
  assert.equal(first.id, initialBin.id);
  assert.equal(first.topic, initialBin.topic);
  assert.equal(first.heightCm, 45);
});
test('three simulation QRs have independent identities, topics and heights', () => {
  const bins = [1, 2, 3].map(index => parseBinQr(readFileSync(new URL(`../../docs/qr/bin-${index}.json`, import.meta.url), 'utf8')));
  assert.equal(new Set(bins.map(bin => bin.id)).size, 3);
  assert.equal(new Set(bins.map(bin => bin.topic)).size, 3);
  assert.deepEqual(bins.map(bin => bin.heightCm), [45, 60, 80]);
  for (const bin of bins) assert.equal(bin.topic, `nhom10/trash/${bin.id}`);
});
test('QR height uses centimetres, accepts tenths and rejects invalid measurements', () => {
  for (const heightCm of [10, 45.5, 60, 400]) {
    assert.equal(parseBinQr(JSON.stringify({ ...payload, heightCm })).heightCm, heightCm);
  }
  for (const heightCm of [null, '45', true, 9.9, 400.1, 45.55, -10]) {
    assert.throws(() => parseBinQr(JSON.stringify({ ...payload, heightCm })));
  }
});
test('rejects unrelated, unsupported, incomplete and unsafe QR payloads', () => {
  for (const data of [null, [], {}, { ...payload, version: 2 }, { ...payload, type: 'url' },
    { ...payload, id: 123 }, { ...payload, id: 'a/b' }, { ...payload, topic: 'bins/#' },
    { ...payload, topic: 'a\u0000b' }, { ...payload, name: '' }]) {
    assert.throws(() => parseBinQr(JSON.stringify(data)));
  }
  assert.throws(() => parseBinQr('https://example.com'));
  assert.throws(() => parseBinQr('x'.repeat(2049)));
});
test('trims fields and ignores broker overrides and credentials', () => {
  assert.deepEqual(parseBinQr(JSON.stringify({ ...payload, id: ` ${initialBin.id} `,
    broker: 'wss://other.example', password: 'secret' })), initialBin);
});
