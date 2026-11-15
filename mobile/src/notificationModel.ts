import type { Bin, Reading } from './model';

export type AlertKind = 'full' | 'odor';
export type AlertData = { type: 'trash-alert'; binId: string; topic: string; brokerUrl: string; kind: AlertKind; eventId: string; demo: boolean };
export type AlertMessage = { title: string; body: string; data: AlertData };
export type NotificationSettings = { mode: 'off' | 'local' | 'push'; installationId: string; serverUrl: string; targets: string[] };
export const targetKey = (bin: Bin, broker: string) => `${broker}|${bin.id}|${bin.topic}`;

export function alertData(value: unknown): AlertData | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as Record<string, unknown>;
  return d.type === 'trash-alert' && typeof d.binId === 'string' && typeof d.topic === 'string' && typeof d.brokerUrl === 'string' &&
    (d.kind === 'full' || d.kind === 'odor') && typeof d.eventId === 'string' && typeof d.demo === 'boolean' ? d as AlertData : null;
}
export class AlertTracker {
  private states = new Map<string, { full?: boolean; odor?: boolean; receivedAt?: number }>();
  observe(bin: Bin, reading: Reading | undefined, broker: string, demo: boolean, now: number): AlertMessage[] {
    const d = reading?.data;
    if (!d || reading?.availability === 'offline' || !reading.liveAt || now - reading.liveAt > 15000 || reading.receivedAt !== reading.liveAt) return [];
    const key = `${demo ? 'demo' : 'live'}|${targetKey(bin, broker)}`;
    const previous = this.states.get(key) || {};
    if (previous.receivedAt === reading.receivedAt) return [];
    const next = { ...previous, receivedAt: reading.receivedAt };
    const events: AlertMessage[] = [];
    const values: Partial<Record<AlertKind, boolean>> = {};
    if (d.configured && d.trash_valid && !d.trash_stale && d.fill_percent !== null) values.full = d.full;
    if (d.gas_valid && d.gas_adc !== null) values.odor = d.gas_high;
    for (const kind of ['full', 'odor'] as const) {
      if (values[kind] === undefined) continue;
      next[kind] = values[kind];
      if (values[kind] && !previous[kind]) events.push({
        title: `${demo ? 'Thử · ' : ''}${kind === 'full' ? 'Thùng rác đã đầy' : 'Thùng rác có mùi hôi'}`,
        body: `${bin.name} ${kind === 'full' ? 'cần được thu gom.' : 'cần được kiểm tra và vệ sinh.'}`,
        data: { type: 'trash-alert', binId: bin.id, topic: bin.topic, brokerUrl: broker, kind, eventId: `${key}|${kind}|${reading.receivedAt}`, demo },
      });
    }
    this.states.set(key, next);
    return events;
  }
}

export function serverUrl(text: string): string {
  const url = new URL(text.trim());
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) throw new Error('Nhập địa chỉ dịch vụ bắt đầu bằng https://.');
  return url.toString().replace(/\/$/, '');
}
export async function notificationFetch(url: string, init: RequestInit, fetcher: typeof fetch = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try { return await fetcher(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}
export async function registerPush(settings: NotificationSettings, credential: string, token: string, bins: Bin[], brokerUrl: string, fetcher: typeof fetch = fetch) {
  const realBins = bins.filter(b => !b.id.startsWith('demo-')).map(({ id, topic, name }) => ({ id, topic, name }));
  const response = await notificationFetch(`${serverUrl(settings.serverUrl)}/v1/registrations/${settings.installationId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` },
    body: JSON.stringify({ token, brokerUrl, bins: realBins }),
  }, fetcher);
  if (!response.ok) {
    if (response.status === 401) throw new Error('Mã kết nối không đúng. Vui lòng kiểm tra lại.');
    if (response.status === 409) throw new Error('Dịch vụ chưa kết nối cùng hệ thống với các thùng của bạn.');
    if (response.status === 400) throw new Error('Có thùng chưa được thêm vào dịch vụ thông báo.');
    throw new Error('Chưa đăng ký được thông báo. Vui lòng thử lại.');
  }
  const result = await response.json();
  if (result?.ok !== true || typeof result.secret !== 'string' || !/^[a-f0-9]{64}$/.test(result.secret) || !Array.isArray(result.bins) ||
      result.bins.length !== realBins.length || !result.bins.every((b: Bin, index: number) => b && b.id === realBins[index].id && b.topic === realBins[index].topic && b.name === realBins[index].name.trim())) throw new Error('Dịch vụ trả về kết quả không hợp lệ.');
  return result as { secret: string; bins: Bin[] };
}
