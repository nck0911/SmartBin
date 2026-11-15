import type { AlertMessage, AlertData } from './notificationModel';

// Web fallback. Native implementation is resolved by Metro from .native.ts.
export const notificationDevice = {
  supported: false, supportsPush: false,
  async permission() { return false; },
  async permissionStatus() { return false; },
  async token(): Promise<string> { throw new Error('Dùng ứng dụng trên điện thoại để nhận thông báo.'); },
  async show(_message: AlertMessage) {},
  async saveSecret(_value: string) {},
  async secret(): Promise<string | null> { return null; },
  listen(_onTap: (data: AlertData) => void) { return () => {}; },
  onTokenChange(_callback: () => void) { return () => {}; },
};
