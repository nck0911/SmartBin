// External provider adapter. Application services depend on send/receipt only.
export class ExpoSender {
  constructor(accessToken, fetcher = fetch) { this.accessToken = accessToken; this.fetcher = fetcher; }
  async request(path, payload) {
    const response = await this.fetcher(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}) },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Expo HTTP ${response.status}`);
    const result = await response.json();
    if (!result?.data || result.errors?.length) throw new Error('Invalid Expo response');
    return result.data;
  }
  async send(message) { const result = await this.request('send', [message]); if (!Array.isArray(result) || !result[0]) throw new Error('Missing push ticket'); return result[0]; }
  async receipt(id) { const result = await this.request('getReceipts', { ids: [id] }); return result[id]; }
}
