import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyBin } from '../src/verifyBin.ts';
import { initialBin } from '../src/model.ts';
const broker = 'wss://broker.example/mqtt';
const address = 'https://api.example';

test('verification sends only identity/broker and requires a matching acknowledgement', async () => {
  const bin = { ...initialBin, name: 'Tên tự đặt', location: 'Vị trí tự đặt' };
  const verified = await verifyBin({ ...bin, heightCm: 99 }, broker, address, async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/v1/devices/verify');
    assert.equal(url.searchParams.get('id'), bin.id);
    assert.equal(url.searchParams.get('topic'), bin.topic);
    assert.equal(url.searchParams.get('brokerUrl'), broker);
    assert.equal(url.searchParams.has('name'), false);
    assert.ok(init?.signal);
    return Response.json({ ok: true, id: bin.id, topic: bin.topic, heightCm: 60 });
  });
  assert.equal(verified.heightCm, 60);
  await assert.rejects(verifyBin(bin, broker, address, async () => Response.json({ ok: true, id: 'other', topic: bin.topic })), /không hợp lệ/);
  for (const heightCm of [undefined, null, '45', 0, 401, 45.55]) {
    await assert.rejects(verifyBin(bin, broker, address, async () => Response.json({ ok: true, id: bin.id, topic: bin.topic, heightCm })), /không hợp lệ/);
  }
});
test('verification blocks unknown devices, mismatched brokers and unreachable backend', async () => {
  for (const status of [400, 404]) await assert.rejects(verifyBin(initialBin, broker, address, async () => new Response(null, { status })), /không thuộc hệ thống/);
  await assert.rejects(verifyBin(initialBin, broker, address, async () => new Response(null, { status: 409 })), /kết nối hiện tại/);
  await assert.rejects(verifyBin(initialBin, broker, address, async () => { throw new TypeError('Network request failed'); }), /Không kết nối được/);
  await assert.rejects(verifyBin(initialBin, broker, address, async () => new Response(null, { status: 503 })), /Chưa xác minh/);
});
test('missing or unsafe backend URLs fail before any network request', async () => {
  for (const url of [undefined, '', 'http://localhost:8787', 'https://user:pass@api.example', 'https://api.example?x=1']) {
    await assert.rejects(verifyBin(initialBin, broker, url, async () => { assert.fail('Unexpected request'); }), /chưa được cấu hình/);
  }
});
test('LAN HTTP is accepted only in development; public HTTP stays blocked', async () => {
  const fetcher: typeof fetch = async () => Response.json({ ok: true, id: initialBin.id, topic: initialBin.topic, heightCm: 45 });
  for (const host of ['10.20.91.228', '192.168.1.10', '172.16.0.5']) {
    await verifyBin(initialBin, broker, `http://${host}:8787`, fetcher, true);
    await assert.rejects(verifyBin(initialBin, broker, `http://${host}:8787`, fetcher, false), /chưa được cấu hình/);
  }
  for (const host of ['8.8.8.8', 'api.example', '172.32.0.1', '10.999.0.1', 'localhost']) {
    await assert.rejects(verifyBin(initialBin, broker, `http://${host}:8787`, fetcher, true), /chưa được cấu hình/);
  }
});
