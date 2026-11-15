import { matches } from '../../security/credentials.mjs';

const tokenPattern = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,256}\]$/;
const failure = (status, error) => ({ status, data: { error } });

// Application service: registration rules independent of HTTP request objects.
export class RegistrationService {
  constructor({ store, pairingCode, devices, appBrokerUrl }) {
    this.store = store;
    this.pairingCode = pairingCode;
    this.devices = devices;
    this.appBrokerUrl = appBrokerUrl;
  }
  authorize(id, credential, method) {
    return this.store.authorize(id, credential) || (method === 'PUT' && matches(credential, this.pairingCode));
  }
  update(id, credential, body) {
    if (!this.authorize(id, credential, 'PUT')) return failure(401, 'unauthorized');
    if (!body || typeof body !== 'object') return failure(400, 'invalid_request');
    if (body.brokerUrl !== this.appBrokerUrl) return failure(409, 'broker_mismatch');
    if (!tokenPattern.test(body.token) || !Array.isArray(body.bins) || body.bins.length > 50) return failure(400, 'invalid_registration');
    const seen = new Set();
    const bins = [];
    for (const bin of body.bins) {
      if (!bin || typeof bin.name !== 'string' || !bin.name.trim() || bin.name.length > 100 || /[\r\n\x00-\x1f]/.test(bin.name) ||
          !this.devices.some(d => d.id === bin.id && d.topic === bin.topic) || seen.has(bin.id)) return failure(400, 'unknown_device');
      seen.add(bin.id); bins.push({ id: bin.id, topic: bin.topic, name: bin.name.trim() });
    }
    if (!this.store.get(id) && this.store.registrationCount() >= 100) return failure(429, 'capacity');
    const existing = this.store.authorize(id, credential);
    const secret = this.store.register(id, body.token, bins, existing ? credential : undefined);
    return { status: 200, data: { ok: true, secret, bins } };
  }
  remove(id, credential) {
    if (!this.authorize(id, credential, 'DELETE')) return failure(401, 'unauthorized');
    this.store.remove(id);
    return { status: 200, data: { ok: true } };
  }
}
