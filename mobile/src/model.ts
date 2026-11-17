export type Bin = { id: string; name: string; location: string; topic: string; heightCm?: number };
export function validHeightCm(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 10 && value <= 400 && Math.round(value * 10) / 10 === value;
}
export type Telemetry = { schema: 1; device_id: string; fill_percent: number | null; gas_adc: number | null; trash_valid: boolean; trash_stale: boolean; gas_valid: boolean; full: boolean; gas_high: boolean; lid_command: 'open' | 'closed'; uptime_ms: number; configured?: boolean; bin_height_cm?: number | null; settings_session?: number };
export type Reading = { data?: Telemetry; receivedAt?: number; liveAt?: number; availability?: string };
export const initialBin: Bin = { id: 'nhom10-trash-7c91a2', name: 'Thùng rác', location: 'Phòng thực hành', topic: 'nhom10/trash/nhom10-trash-7c91a2' };
export function decode(raw: string, id: string): Telemetry | null {
  try {
    const d = JSON.parse(raw);
    if (!d || d.schema !== 1 || d.device_id !== id || !['open', 'closed'].includes(d.lid_command)) return null;
    if (!['trash_valid','trash_stale','gas_valid','full','gas_high'].every(k => typeof d[k] === 'boolean')) return null;
    if (!(d.fill_percent === null || (Number.isFinite(d.fill_percent) && d.fill_percent >= 0 && d.fill_percent <= 100))) return null;
    if (!(d.gas_adc === null || (Number.isInteger(d.gas_adc) && d.gas_adc >= 0 && d.gas_adc <= 4095))) return null;
    if (!Number.isFinite(d.uptime_ms) || d.uptime_ms < 0) return null;
    // Older firmware can still supply gas/status, but cannot supply trusted fill %.
    if (['configured','bin_height_cm','settings_session'].some(k => k in d)) {
      if (typeof d.configured !== 'boolean' || !Number.isInteger(d.settings_session) || d.settings_session <= 0 || d.settings_session > 0xffffffff) return null;
      if (d.configured ? !(Number.isFinite(d.bin_height_cm) && d.bin_height_cm >= 10 && d.bin_height_cm <= 400) : d.bin_height_cm !== null) return null;
      if (!d.configured && (d.fill_percent !== null || d.full)) return null;
    }
    return d;
  } catch { return null; }
}
export function status(r: Reading | undefined, connected: boolean, now: number) {
  if (!connected) return 'Mất kết nối dịch vụ';
  if (r?.availability === 'offline') return 'Thùng đang ngoại tuyến';
  if (!r?.data) return 'Chờ dữ liệu';
  if (!r.liveAt || now - r.liveAt > 15000) return 'Dữ liệu cũ';
  return 'Đang cập nhật';
}
export function validateBin(b: Bin, bins: Bin[], previousId?: string) {
  if (b.heightCm !== undefined && !validHeightCm(b.heightCm)) return 'Chiều cao trong QR phải từ 10 đến 400 cm, tối đa 1 chữ số thập phân.';
  if (![b.id,b.name,b.location,b.topic].every(s => s.trim())) return 'Vui lòng điền đủ các trường.';
  if (/[+#\s]/.test(b.topic) || b.topic.startsWith('/') || b.topic.endsWith('/')) return 'Đường dẫn dữ liệu không chứa khoảng trắng, +, # hoặc dấu / ở đầu/cuối.';
  if (bins.some(x => x.id !== previousId && (x.id === b.id || x.topic === b.topic))) return 'Mã thiết bị hoặc đường dẫn dữ liệu đã có trong danh sách.';
  return '';
}
