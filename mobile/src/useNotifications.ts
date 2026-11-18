import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { Bin, Reading } from './model';
import { notificationDevice } from './notificationDevice';
import { AlertTracker, notificationFetch, registerPush, serverUrl, targetKey } from './notificationModel';
import type { NotificationSettings } from './notificationModel';

type Input = { bins: Bin[]; broker: string; readings: Record<string, Reading>; ready: boolean; connected: boolean; now: number };
const storageKey = 'smartbin-notifications-v1';
export function useNotifications(monitor: Input, openBin: (id: string) => void) {
  const { bins, broker, readings, ready, connected, now } = monitor;
  const [settings, setSettings] = useState<NotificationSettings>(() => ({ mode: 'off', installationId: `install_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`, serverUrl: '', targets: [] }));
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const tracker = useRef(new AlertTracker());
  const serial = useRef<Promise<unknown>>(Promise.resolve());
  const handledTaps = useRef(new Set<string>());
  const initialSettings = useRef(settings);
  const enqueue = useCallback(<T,>(task: () => Promise<T>) => {
    const result = serial.current.then(task, task);
    serial.current = result.catch(() => {});
    return result;
  }, []);
  const persist = useCallback(async (next: NotificationSettings) => {
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    setSettings(next);
  }, []);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then(raw => {
      if (!active) return;
      if (!raw) return AsyncStorage.setItem(storageKey, JSON.stringify(initialSettings.current));
      const saved = JSON.parse(raw);
      if (['off', 'local', 'push'].includes(saved.mode) && /^[A-Za-z0-9_-]{16,64}$/.test(saved.installationId) && typeof saved.serverUrl === 'string' && Array.isArray(saved.targets) && saved.targets.every((v: unknown) => typeof v === 'string')) {
        const next = saved.mode === 'local' ? { ...saved, mode: 'off', targets: [] } : saved;
        setSettings(next);
        if (saved.mode === 'local') return AsyncStorage.setItem(storageKey, JSON.stringify(next));
      }
    }).catch(() => { if (active) setError('Không đọc được thiết lập thông báo.'); }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setRevision(old => old + 1); });
    const removeTokenListener = notificationDevice.onTokenChange(() => setRevision(old => old + 1));
    return () => { subscription.remove(); removeTokenListener(); };
  }, []);
  useEffect(() => {
    if (!loaded || settings.mode !== 'local' || !notificationDevice.supported) return;
    let active = true;
    void notificationDevice.permissionStatus().then(allowed => {
      if (active && !allowed) setError('Thông báo đang bị chặn. Hãy cho phép lại trong cài đặt điện thoại.');
    }).catch(() => { if (active) setError('Chưa kiểm tra được quyền thông báo trên điện thoại.'); });
    return () => { active = false; };
  }, [loaded, settings.mode, revision]);
  useEffect(() => {
    if (!ready) return;
    return notificationDevice.listen(data => {
      if (data.demo) return;
      if (handledTaps.current.has(data.eventId)) return;
      handledTaps.current.add(data.eventId);
      if (data.brokerUrl !== broker) { setError('Thông báo thuộc kết nối thùng trước đó. Kiểm tra lại dịch vụ thông báo.'); return; }
      if (!bins.some(bin => bin.id === data.binId && bin.topic === data.topic)) { setError('Thùng trong thông báo không còn trong danh sách.'); return; }
      openBin(data.binId);
    });
  }, [ready, bins, broker, openBin]);
  useEffect(() => {
    if (!loaded || settings.mode === 'off' || !connected) return;
    for (const bin of bins) {
      const events = tracker.current.observe(bin, readings[bin.id], broker, false, now);
      // The service owns device pushes.
      if (settings.mode === 'push') continue;
      for (const event of events) void notificationDevice.show(event).catch(() => setError('Không hiển thị được thông báo. Kiểm tra quyền trong cài đặt điện thoại.'));
    }
  }, [loaded, settings.mode, connected, bins, readings, broker, now]);
  useEffect(() => {
    if (!loaded || !ready || settings.mode !== 'push') return;
    let cancelled = false;
    void enqueue(async () => {
      if (cancelled) return;
      const secret = await notificationDevice.secret();
      if (!secret) throw new Error('Cần kết nối lại dịch vụ thông báo.');
      if (!(await notificationDevice.permissionStatus())) throw new Error('Thông báo đang bị chặn trong cài đặt điện thoại.');
      const token = await notificationDevice.token();
      const result = await registerPush(settings, secret, token, bins, broker);
      if (!cancelled) {
        const nextTargets = result.bins.map(bin => targetKey(bin, broker));
        if (JSON.stringify(nextTargets) !== JSON.stringify(settings.targets)) await persist({ ...settings, targets: nextTargets });
        setMessage('Đã đồng bộ danh sách nhận thông báo.'); setError('');
      }
    }).catch(reason => { if (!cancelled) setError(`${reason instanceof Error ? reason.message : 'Chưa đồng bộ được thông báo.'} Dịch vụ có thể vẫn theo dõi danh sách đã đăng ký trước đó.`); });
    return () => { cancelled = true; };
  }, [loaded, ready, settings, bins, broker, revision, enqueue, persist]);

  async function revoke() {
    if (settings.mode !== 'push') return;
    const secret = await notificationDevice.secret();
    if (!secret) throw new Error('Không tìm thấy thông tin kết nối. Nhập lại mã kết nối để khôi phục trước khi tắt.');
    const response = await notificationFetch(`${serverUrl(settings.serverUrl)}/v1/registrations/${settings.installationId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${secret}` } });
    if (!response.ok) throw new Error('Chưa tắt được thông báo từ dịch vụ. Kiểm tra kết nối rồi thử lại.');
  }
  async function perform(task: () => Promise<void>) {
    if (busy || !loaded) return false;
    setBusy(true); setError(''); setMessage('');
    try { await enqueue(task); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa cập nhật được thông báo. Vui lòng thử lại.'); return false; }
    finally { setBusy(false); }
  }
  const enableLocal = () => perform(async () => {
    if (!(await notificationDevice.permission())) throw new Error('Hãy cho phép thông báo trong cài đặt điện thoại để tiếp tục.');
    await revoke(); await persist({ ...settings, mode: 'local', targets: [] });
    setMessage('Đã bật thông báo khi app đang nhận dữ liệu.');
  });
  const disable = () => perform(async () => { await revoke(); await persist({ ...settings, mode: 'off', targets: [] }); setMessage('Đã tắt thông báo.'); });
  const enablePush = (address: string, code: string) => perform(async () => {
    if (!notificationDevice.supportsPush) throw new Error('Cần cài bản ứng dụng riêng để nhận thông báo khi đóng app.');
    const url = serverUrl(address);
    if (settings.mode === 'push' && url !== settings.serverUrl) throw new Error('Tắt kết nối hiện tại trước khi đổi dịch vụ thông báo.');
    if (!(await notificationDevice.permission())) throw new Error('Hãy cho phép thông báo trong cài đặt điện thoại để tiếp tục.');
    const token = await notificationDevice.token();
    const credential = code.trim() || (settings.mode === 'push' && url === settings.serverUrl ? await notificationDevice.secret() : null);
    if (!credential) throw new Error('Nhập mã kết nối để bật thông báo.');
    const next = { ...settings, serverUrl: url, mode: 'push' as const };
    const result = await registerPush(next, credential, token, bins, broker);
    await notificationDevice.saveSecret(result.secret);
    await persist({ ...next, targets: result.bins.map(bin => targetKey(bin, broker)) });
    setMessage('Đã bật thông báo kể cả khi đóng app.');
  });
  const enableNotifications = () => perform(async () => {
    if (!(await notificationDevice.permission())) throw new Error('Hãy cho phép thông báo trong cài đặt điện thoại để tiếp tục.');
    if (!notificationDevice.supportsPush) throw new Error('Cần bản cài SmartBin riêng để bật thông báo đẩy.');
    const secret = await notificationDevice.secret();
    if (!settings.serverUrl || !secret) throw new Error('Dịch vụ thông báo đẩy chưa được thiết lập cho bản ứng dụng này.');
    const token = await notificationDevice.token();
    const next = { ...settings, mode: 'push' as const };
    const result = await registerPush(next, secret, token, bins, broker);
    await notificationDevice.saveSecret(result.secret);
    await persist({ ...next, targets: result.bins.map(bin => targetKey(bin, broker)) });
    setMessage('Đã bật thông báo đẩy.');
  });
  const test = () => perform(async () => {
    if (!(await notificationDevice.permission())) throw new Error('Hãy cho phép thông báo trong cài đặt điện thoại.');
    const bin = bins[0];
    if (!bin) throw new Error('Thêm một thùng để thử thông báo.');
    await notificationDevice.show({ title: 'Thử thông báo thùng rác', body: `${bin.name} · Đây là thông báo kiểm tra.`, data: { type: 'smartbin-alert', binId: bin.id, topic: bin.topic, brokerUrl: broker, kind: 'full', eventId: `test_${Date.now()}`, demo: false } });
    setMessage('Đã gửi thông báo thử trên điện thoại.');
  });
  return { settings, loaded, busy, message, error, supported: notificationDevice.supported, supportsPush: notificationDevice.supportsPush, enableNotifications, enableLocal, enablePush, disable, test, sync: () => setRevision(old => old + 1) };
}
