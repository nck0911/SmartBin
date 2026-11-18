import { RegistrationService } from '../services/registrations/registrations.mjs';

export function createHandler({ store, pairingCode, devices, appBrokerUrl, isConnected = () => false }) {
  const registrations = new RegistrationService({ store, pairingCode, devices, appBrokerUrl });
  return async (req, res) => {
    const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    if (req.method === 'GET' && req.url === '/health') { reply(200, { ok: true, mqttConnected: isConnected() }); return; }
    if (req.method === 'GET' && req.url?.split('?')[0] === '/v1/devices/verify') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      const params = new URL(req.url, 'http://localhost').searchParams;
      const id = params.get('id');
      const topic = params.get('topic');
      if (!id?.trim() || !topic?.trim() || id.length > 256 || topic.length > 256) { reply(400, { error: 'invalid_device' }); return; }
      if (params.get('brokerUrl') !== appBrokerUrl) { reply(409, { error: 'broker_mismatch' }); return; }
      const device = devices.find(device => device.id === id && device.topic === topic);
      if (!device) { reply(404, { error: 'unknown_device' }); return; }
      if (!Number.isFinite(device.heightCm) || device.heightCm < 10 || device.heightCm > 400 || Math.round(device.heightCm * 10) / 10 !== device.heightCm) { reply(503, { error: 'device_height_missing' }); return; }
      reply(200, { ok: true, id, topic, heightCm: device.heightCm }); return;
    }
    const match = /^\/v1\/registrations\/([A-Za-z0-9_-]{16,64})$/.exec(req.url || '');
    if (!match || !['PUT', 'DELETE'].includes(req.method)) { reply(404, { error: 'not_found' }); return; }
    const id = match[1];
    const bearer = req.headers.authorization?.replace(/^Bearer /, '') || '';
    if (!registrations.authorize(id, bearer, req.method)) { reply(401, { error: 'unauthorized' }); return; }
    if (req.method === 'DELETE') { const result = registrations.remove(id, bearer); reply(result.status, result.data); return; }
    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk.toString();
        if (Buffer.byteLength(raw) > 16_384) { reply(413, { error: 'body_too_large' }); return; }
      }
      const result = registrations.update(id, bearer, JSON.parse(raw));
      reply(result.status, result.data);
    } catch { if (!res.headersSent) reply(400, { error: 'invalid_request' }); }
  };
}
