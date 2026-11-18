import { validateBin } from './model.ts';
import type { Bin } from './model.ts';

// QR deliberately contains no credentials or broker override.
export function parseBinQr(raw: string): Bin {
  if (raw.length > 2048) throw new Error('Mã QR quá dài.');
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('Đây không phải mã QR thùng rác.'); }
  if (!data || data.type !== 'smartbin-bin' || data.version !== 1 ||
      !['id', 'name', 'location', 'topic'].every(key => typeof data[key] === 'string' && data[key].length <= 256)) {
    throw new Error('Mã QR thùng rác không hợp lệ hoặc chưa được hỗ trợ.');
  }
  const bin: Bin = { id: data.id.trim(), name: data.name.trim(), location: data.location.trim(), topic: data.topic.trim() };
  if ('heightCm' in data) bin.heightCm = data.heightCm;
  const problem = validateBin(bin, []);
  if (problem) throw new Error(problem);
  return bin;
}
