import { matches } from './store.mjs';

const tokenPattern = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,256}\]$/;
export function createHandler({ store, pairingCode, devices, appBrokerUrl, isConnected = () => false }) {
  return async (req, res) => {
    const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    if (req.method === 'GET' && req.url === '/health') { reply(200, { ok: true, mqttConnected: isConnected() }); return; }
    const match = /^\/v1\/registrations\/([A-Za-z0-9_-]{16,64})$/.exec(req.url || '');
    if (!match || !['PUT', 'DELETE'].includes(req.method)) { reply(404, { error: 'not_found' }); return; }
    const id = match[1];
    const bearer = req.headers.authorization?.replace(/^Bearer /, '') || '';
    const existing = store.authorize(id, bearer);
    const pairing = req.method === 'PUT' && matches(bearer, pairingCode);
    if (!existing && !pairing) { reply(401, { error: 'unauthorized' }); return; }
    if (req.method === 'DELETE') { store.remove(id); reply(200, { ok: true }); return; }
    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk.toString();
        if (Buffer.byteLength(raw) > 16_384) { reply(413, { error: 'body_too_large' }); return; }
      }
      const body = JSON.parse(raw);
      if (body.brokerUrl !== appBrokerUrl) { reply(409, { error: 'broker_mismatch' }); return; }
      if (!tokenPattern.test(body.token) || !Array.isArray(body.bins) || body.bins.length > 50) { reply(400, { error: 'invalid_registration' }); return; }
      const seen = new Set();
      const bins = [];
      for (const bin of body.bins) {
        if (!bin || typeof bin.name !== 'string' || !bin.name.trim() || bin.name.length > 100 || /[\r\n\x00-\x1f]/.test(bin.name) ||
            !devices.some(d => d.id === bin.id && d.topic === bin.topic) || seen.has(bin.id)) { reply(400, { error: 'unknown_device' }); return; }
        seen.add(bin.id); bins.push({ id: bin.id, topic: bin.topic, name: bin.name.trim() });
      }
      if (!store.get(id) && store.db.prepare('SELECT COUNT(*) AS n FROM installations').get().n >= 100) { reply(429, { error: 'capacity' }); return; }
      const secret = store.register(id, body.token, bins, existing ? bearer : undefined);
      reply(200, { ok: true, secret, bins });
    } catch { if (!res.headersSent) reply(400, { error: 'invalid_request' }); }
  };
}
