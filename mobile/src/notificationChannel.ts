import type { NotificationChannelInput } from 'expo-notifications';

// New ID avoids reusing a channel created with null/custom audio attributes.
// Keep the service's channelId in sync: backend/src/services/notifications/alerts.mjs.
export const ALERT_CHANNEL_ID = 'smartbin-alerts-v1';
export function notificationChannelId(platform: string, version: number, isExpoGo: boolean): string | null {
  // Expo Go owns its native channels. Immediate local notifications can use
  // Expo's native fallback channel without crossing the custom-channel bridge.
  return platform === 'android' && version >= 26 && !isExpoGo ? ALERT_CHANNEL_ID : null;
}
type ChannelApi = {
  AndroidImportance: { HIGH: number };
  setNotificationChannelAsync: (id: string, options: NotificationChannelInput) => Promise<unknown>;
};

export function createChannelInitializer() {
  let pending: Promise<void> | undefined;
  return (api: ChannelApi): Promise<void> => {
    if (!pending) {
      // Leave sound/audioAttributes/vibration to Android defaults. Passing sound
      // without audioAttributes goes through a nullable native audio path.
      pending = Promise.resolve().then(() => api.setNotificationChannelAsync(ALERT_CHANNEL_ID, {
        name: 'Cảnh báo thùng rác',
        importance: api.AndroidImportance.HIGH,
      })).then(result => {
        if (!result) throw new Error('Android không trả về kênh thông báo.');
      }).catch(error => { pending = undefined; throw error; });
    }
    return pending;
  };
}
