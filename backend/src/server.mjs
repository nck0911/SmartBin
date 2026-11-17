import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import mqtt from 'mqtt';
import { Store } from './storage/store.mjs';
import { processReading } from './services/notifications/alerts.mjs';
import { deliver } from './services/notifications/delivery.mjs';
import { ExpoSender } from './integrations/expoPush.mjs';
import { createHandler } from './http/handler.mjs';

const pairingCode = process.env.PAIRING_CODE;
if (!pairingCode || pairingCode.length < 16) throw new Error('Set PAIRING_CODE to at least 16 characters.');
const devices = JSON.parse(process.env.DEVICES_JSON || '[]');
if (!Array.isArray(devices) || !devices.length || devices.some(d => !d || typeof d.id !== 'string' || typeof d.topic !== 'string' || !d.id || !d.topic || /[+#\s]/.test(d.topic))) throw new Error('DEVICES_JSON must contain explicit device IDs and topic roots.');
if (new Set(devices.map(d => d.id)).size !== devices.length || new Set(devices.map(d => d.topic)).size !== devices.length) throw new Error('Device IDs and topics must be unique.');
if (!process.env.MQTT_URL || !process.env.APP_BROKER_URL) throw new Error('Set MQTT_URL and APP_BROKER_URL.');
const filename = resolve('data/notifications.sqlite');
mkdirSync(dirname(filename), { recursive: true });
const store = new Store(filename, process.env.APP_BROKER_URL);
const client = mqtt.connect(process.env.MQTT_URL, { username: process.env.MQTT_USER, password: process.env.MQTT_PASSWORD, clean: true, reconnectPeriod: 3000 });
client.on('connect', () => client.subscribe(devices.flatMap(d => [`${d.topic}/state`, `${d.topic}/events`]), error => { if (error) console.error('MQTT subscription failed.'); }));
client.on('message', (topic, payload, packet) => {
  const device = devices.find(d => topic === `${d.topic}/state` || topic === `${d.topic}/events`);
  if (device) { try { processReading(store, device, payload.toString(), packet.retain); } catch { console.error('Could not persist alert.'); } }
});
client.on('error', () => console.error('MQTT unavailable; reconnecting.'));
const sender = new ExpoSender(process.env.EXPO_ACCESS_TOKEN);
let delivering = false;
const timer = setInterval(async () => {
  if (delivering) return;
  delivering = true;
  try { await deliver(store, sender, Date.now(), code => console.error(`Push delivery: ${/^[A-Za-z0-9_]{1,64}$/.test(code) ? code : 'unknown_error'}`)); } catch { console.error('Notification worker failed.'); }
  finally { delivering = false; }
}, 1000);
const server = createServer(createHandler({ store, pairingCode, devices, appBrokerUrl: process.env.APP_BROKER_URL, isConnected: () => client.connected }));
server.requestTimeout = 10_000;
server.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1', () => console.log('SmartBin backend listening.'));
function shutdown() { clearInterval(timer); client.end(true); server.close(); /* OS closes SQLite after pending work exits. */ }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
