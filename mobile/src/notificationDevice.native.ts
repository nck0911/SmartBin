import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { alertData } from './notificationModel';
import type { AlertData, AlertMessage } from './notificationModel';
import { createChannelInitializer, notificationChannelId } from './notificationChannel';

// Use the same native capability check as expo-notifications itself. Constants
// metadata is not the authority for whether the host is Expo Go.
const customChannelId = () => notificationChannelId(Platform.OS, Number(Platform.Version), isRunningInExpoGo());
let loaded: Promise<typeof import('expo-notifications')> | undefined;
const ensureChannel = createChannelInitializer();
async function notifications() {
  if (!loaded) loaded = import('expo-notifications').then(module => {
    module.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
    return module;
  });
  return loaded;
}
async function channel() {
  const module = await notifications();
  if (customChannelId()) {
    try { await ensureChannel(module); }
    catch (error) {
      console.error('Android notification channel initialization failed', error);
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Không khởi tạo được kênh thông báo của bản ứng dụng này. Chi tiết: ${detail}`);
    }
  }
  return module;
}
const granted = (permission: import('expo-notifications').NotificationPermissionsStatus) => permission.granted || permission.ios?.status === 3;
export const notificationDevice = {
  supported: true, get supportsPush() { return !isRunningInExpoGo(); },
  async permission() {
    const module = await channel();
    const current = await module.getPermissionsAsync();
    if (granted(current)) return true;
    if (!current.canAskAgain) return false;
    return granted(await module.requestPermissionsAsync());
  },
  async permissionStatus() { return granted(await (await notifications()).getPermissionsAsync()); },
  async token() {
    if (isRunningInExpoGo()) throw new Error('Cần cài bản ứng dụng riêng để nhận thông báo khi đóng app.');
    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error('Bản ứng dụng chưa được thiết lập dịch vụ thông báo. Xem hướng dẫn cài đặt.');
    const module = await channel();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        module.getExpoPushTokenAsync({ projectId }).then(result => result.data),
        new Promise<string>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Chưa đăng ký được điện thoại. Kiểm tra Internet rồi thử lại.')), 20000); }),
      ]);
    } catch {
      throw new Error('Chưa đăng ký được thông báo trên điện thoại. Kiểm tra Internet và thiết lập dịch vụ cho bản ứng dụng này.');
    } finally { if (timer) clearTimeout(timer); }
  },
  async show(message: AlertMessage) {
    const module = await channel();
    const channelId = customChannelId();
    await module.scheduleNotificationAsync({ content: { title: message.title, body: message.body, data: message.data, sound: 'default' }, trigger: channelId ? { channelId } : null });
  },
  async saveSecret(value: string) { await SecureStore.setItemAsync('trash-push-secret', value); },
  async secret() { return SecureStore.getItemAsync('trash-push-secret'); },
  listen(onTap: (data: AlertData) => void) {
    let cancelled = false;
    let subscription: { remove: () => void } | undefined;
    const consume = (response: import('expo-notifications').NotificationResponse | null) => {
      if (cancelled || !response) return;
      const data = alertData(response.notification.request.content.data);
      if (data) onTap(data);
      void notifications().then(m => m.clearLastNotificationResponseAsync());
    };
    void notifications().then(module => {
      if (cancelled) return;
      subscription = module.addNotificationResponseReceivedListener(consume);
      consume(module.getLastNotificationResponse());
    }).catch(() => {});
    return () => { cancelled = true; subscription?.remove(); };
  },
  onTokenChange(callback: () => void) {
    if (isRunningInExpoGo()) return () => {};
    let cancelled = false;
    let subscription: { remove: () => void } | undefined;
    void notifications().then(module => { if (!cancelled) subscription = module.addPushTokenListener(callback); }).catch(() => {});
    return () => { cancelled = true; subscription?.remove(); };
  },
};
