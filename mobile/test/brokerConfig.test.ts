import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mqttBrokerUrl } from '../src/brokerConfig.ts';

test('MQTT broker comes from deployment configuration without a hardcoded fallback', () => {
  assert.equal(mqttBrokerUrl(' wss://mqtt.example.test/ws '), 'wss://mqtt.example.test/ws');
  for (const address of [undefined, '', '  ']) assert.throws(() => mqttBrokerUrl(address), /Chưa cấu hình/);
  for (const address of ['ws://mqtt.example.test', 'mqtt://mqtt.example.test', 'https://mqtt.example.test', 'wss://user:secret@mqtt.example.test', 'wss://mqtt.example.test#fragment', 'invalid']) {
    assert.throws(() => mqttBrokerUrl(address), /không hợp lệ/);
  }
});
