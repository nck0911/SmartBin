import type { Reading } from './model.ts';
import { status } from './model.ts';

export function batteryStatus(reading: Reading | undefined, connected: boolean, now: number) {
  const data = reading?.data;
  if (status(reading, connected, now) !== 'Đang cập nhật' || data?.battery_valid !== true || !Number.isInteger(data.battery_percent) || data.battery_percent! < 0 || data.battery_percent! > 100) {
    return { percent: null, level: 'unknown' } as const;
  }
  const percent = data.battery_percent!;
  return { percent, level: percent < 10 ? 'critical' : percent <= 20 ? 'low' : 'normal' } as const;
}
