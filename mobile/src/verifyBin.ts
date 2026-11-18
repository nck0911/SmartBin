import type { Bin } from './model.ts';
import { validHeightCm } from './model.ts';

export async function verifyBin(bin: Bin, brokerUrl: string, address: string | undefined, fetcher: typeof fetch = fetch, development = false) {
  let base: URL;
  try {
    base = new URL(address?.trim() || '');
    const octets = base.hostname.split('.').map(Number);
    const lanHost = /^\d+\.\d+\.\d+\.\d+$/.test(base.hostname) && octets.every(value => value >= 0 && value <= 255) &&
      (octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168));
    const localDevelopment = development && base.protocol === 'http:' && lanHost;
    if ((!localDevelopment && base.protocol !== 'https:') || !base.hostname || base.username || base.password || base.search || base.hash) throw Error();
  } catch { throw new Error('Dịch vụ xác minh thùng chưa được cấu hình.'); }
  const query = new URLSearchParams({ id: bin.id, topic: bin.topic, brokerUrl });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(`${base.toString().replace(/\/$/, '')}/v1/devices/verify?${query}`, { signal: controller.signal });
    if (response.status === 404 || response.status === 400) throw new Error('Mã thiết bị hoặc đường dẫn dữ liệu không thuộc hệ thống.');
    if (response.status === 409) throw new Error('Thùng không thuộc kết nối hiện tại.');
    if (!response.ok) throw new Error('Chưa xác minh được thùng. Vui lòng thử lại.');
    const result = await response.json();
    if (result?.ok !== true || result.id !== bin.id || result.topic !== bin.topic || !validHeightCm(result.heightCm)) throw new Error('Kết quả xác minh thùng không hợp lệ.');
    return { heightCm: result.heightCm };
  } catch (error) {
    if (error instanceof TypeError || controller.signal.aborted) throw new Error('Không kết nối được dịch vụ xác minh. Kiểm tra kết nối rồi thử lại.');
    throw error;
  } finally { clearTimeout(timer); }
}
