import type { Reading } from './model';

export function parseHeight(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d)?$/.test(normalized)) return null;
  const mm = Math.round(Number(normalized) * 10);
  return mm >= 100 && mm <= 4000 ? mm : null;
}

export function heightCommand(requestId: string, mm: number, reading: Reading | undefined, now: number) {
  const data = reading?.data;
  if (!data?.settings_session) throw new Error('Thiết bị cần cập nhật firmware để thiết lập chiều cao.');
  if (!reading?.liveAt || now - reading.liveAt > 15000 || reading.availability === 'offline' || reading.receivedAt === undefined) {
    throw new Error('Chờ thiết bị cập nhật dữ liệu rồi thử lại.');
  }
  if (!Number.isInteger(mm) || mm < 100 || mm > 4000) throw new Error('Nhập chiều cao từ 10 đến 400 cm.');
  const deadline = (data.uptime_ms + Math.max(0, now - reading.receivedAt) + 15000) >>> 0;
  return `${requestId}:${data.settings_session}:${deadline}:${mm}`;
}

const errorText: Record<string, string> = {
  storage: 'Thiết bị không lưu được thiết lập. Vui lòng thử lại.',
  invalid_height: 'Chiều cao không được thiết bị chấp nhận.',
  expired: 'Yêu cầu đã hết hạn. Chờ dữ liệu mới rồi thử lại.',
  busy: 'Thiết bị đang xử lý yêu cầu khác. Vui lòng thử lại.',
};
type Pending = { deviceId: string; mm: number; resolve: () => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> };

// Only a matching device acknowledgement completes a save, never a broker PUBACK.
export class HeightRequests {
  private pending = new Map<string, Pending>();
  private timeoutMs: number;
  constructor(timeoutMs = 12000) { this.timeoutMs = timeoutMs; }

  send(requestId: string, deviceId: string, mm: number, publish: (failed: (error?: Error | null) => void) => void): Promise<void> {
    if ([...this.pending.values()].some(p => p.deviceId === deviceId)) return Promise.reject(new Error('Đang chờ thiết bị xác nhận.'));
    return new Promise((resolve, reject) => {
      const fail = (error: Error) => {
        const request = this.pending.get(requestId);
        if (!request) return;
        clearTimeout(request.timer);
        this.pending.delete(requestId);
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error('Chưa nhận được xác nhận. Thiết lập có thể đã được lưu; chờ dữ liệu mới để kiểm tra hoặc thử lại.')), this.timeoutMs);
      this.pending.set(requestId, { deviceId, mm, resolve, reject, timer });
      try { publish(error => { if (error) fail(new Error('Không gửi được yêu cầu. Vui lòng thử lại.')); }); }
      catch { fail(new Error('Không gửi được yêu cầu. Vui lòng thử lại.')); }
    });
  }

  receive(raw: string, deviceId: string): boolean {
    try {
      const response = JSON.parse(raw);
      if (!response || typeof response.request_id !== 'string' || typeof response.ok !== 'boolean') return false;
      const request = this.pending.get(response.request_id);
      if (!request || request.deviceId !== deviceId || response.device_id !== deviceId || response.height_mm !== request.mm) return false;
      clearTimeout(request.timer);
      this.pending.delete(response.request_id);
      if (response.ok) request.resolve();
      else request.reject(new Error(errorText[response.error] || 'Thiết bị không chấp nhận thiết lập. Vui lòng thử lại.'));
      return true;
    } catch { return false; }
  }

  cancelAll(message = 'Kết nối đã thay đổi. Chưa xác nhận được thiết lập; chờ dữ liệu mới rồi thử lại.') {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(message));
    }
    this.pending.clear();
  }
}
