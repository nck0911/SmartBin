import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mqtt from 'mqtt';
import { AppState } from 'react-native';
import { Bin, Reading, decode, initialBin, validHeightCm } from './model';
import { HeightRequests, heightCommand, systemHeightToApply } from './heightSettings';
import { mqttBrokerUrl } from './brokerConfig';

export function useMonitor() {
  const [bins, setBins] = useState<Bin[]>([]);
  const brokerConfig = useMemo(() => {
    try { return { url: mqttBrokerUrl(process.env.EXPO_PUBLIC_MQTT_URL), error: '' }; }
    catch (reason) { return { url: '', error: reason instanceof Error ? reason.message : 'Không đọc được cấu hình kết nối dữ liệu.' }; }
  }, []);
  const broker = brokerConfig.url;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const clientRef = useRef<ReturnType<typeof mqtt.connect> | null>(null);
  const requests = useRef(new HeightRequests());
  const heightSyncAttempts = useRef(new Map<string, { count: number; at: number }>());
  const scope = useMemo(() => ({ ready, active, bins, broker }), [ready, active, bins, broker]);
  const [stream, setStream] = useState<{ scope: typeof scope | null; connected: boolean; readings: Record<string, Reading> }>({ scope: null, connected: false, readings: {} });
  // A new session immediately hides previous readings, without an effect-driven reset render.
  const connected = stream.scope === scope && stream.connected;
  const readings = useMemo(() => stream.scope === scope ? stream.readings : {}, [stream, scope]);
  useEffect(() => {
    AsyncStorage.getItem('smartbin-monitor-v1').then(raw => {
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.bins) && saved.bins.every((b: Bin) => b && ['id','name','location','topic'].every(k => typeof (b as any)[k] === 'string'))) {
        // Remove only the untouched legacy sample once; preserve manually named bins.
        setBins(saved.bins.filter((b: Bin) => !(/^demo-\d+$/.test(b.id) && b.topic === `demo/${b.id}`) && (saved.onboardingVersion === 2 ||
          !(b.id === initialBin.id && b.topic === initialBin.topic && b.location === initialBin.location &&
            [initialBin.name, 'Thùng rác nhóm 10'].includes(b.name)))).map((b: Bin) => {
              const { heightCm, ...base } = b;
              return validHeightCm(heightCm) ? { ...base, heightCm } : base;
            }));
      }
    }).catch(() => setError('Không đọc được cấu hình đã lưu.')).finally(() => setReady(true));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  useEffect(() => {
    if (ready) AsyncStorage.setItem('smartbin-monitor-v1', JSON.stringify({ bins, onboardingVersion: 2 })).catch(() => setError('Không lưu được cấu hình.'));
  }, [ready, bins]);
  useEffect(() => {
    const { ready, active, bins, broker } = scope;
    function setConnected(value: boolean) {
      setStream(old => ({ scope, connected: value, readings: old.scope === scope ? old.readings : {} }));
    }
    function setReadings(update: SetStateAction<Record<string, Reading>>) {
      setStream(old => ({ scope, connected: old.scope === scope && old.connected, readings: typeof update === 'function' ? update(old.scope === scope ? old.readings : {}) : update }));
    }
    if (!ready || !active || !broker) return;
    const client = mqtt.connect(broker, { clientId: `smartbin_app_${Math.random().toString(16).slice(2)}`, clean: true, queueQoSZero: false, reconnectPeriod: 3000, connectTimeout: 10000, forceNativeWebSocket: true });
    clientRef.current = client;
    client.on('connect', () => {
      setConnected(true); setError('');
      const topics = bins.flatMap(b => ['state','events','availability','config/result'].map(s => `${b.topic}/${s}`));
      if (topics.length) client.subscribe(topics, err => { if (err) setError('Không thể theo dõi dữ liệu thùng. Kiểm tra kết nối rồi thử lại.'); });
    });
    client.on('offline', () => { setConnected(false); requests.current.cancelAll(); });
    client.on('close', () => { setConnected(false); requests.current.cancelAll(); setReadings(old => Object.fromEntries(Object.entries(old).map(([id,r]) => [id,{...r,liveAt: undefined}]))); });
    client.on('error', () => setError('Không thể kết nối dịch vụ. Đang thử lại…'));
    client.on('message', (topic, payload, packet) => {
      const b = bins.find(b => ['state','events','availability','config/result'].some(s => topic === `${b.topic}/${s}`));
      if (!b) return;
      const raw = payload.toString();
      if (topic.endsWith('/config/result')) {
        if (!packet.retain) requests.current.receive(raw, b.id);
        return;
      }
      if (topic.endsWith('/availability')) {
        if (raw === 'online' || raw === 'offline') setReadings(old => ({...old,[b.id]: {...old[b.id],availability: raw}}));
        return;
      }
      const data = decode(raw, b.id);
      if (!data) return;
      const at = Date.now();
      setReadings(old => ({...old,[b.id]: {...old[b.id], data, receivedAt: at, liveAt: packet.retain ? old[b.id]?.liveAt : at}}));
    });
    const tracker = requests.current;
    return () => { clientRef.current = null; tracker.cancelAll(); client.removeAllListeners(); client.end(true); };
  }, [scope]);
  const saveHeight = useCallback(async (bin: Bin, mm: number) => {
    if (readings[bin.id]?.data?.configured) throw new Error('Thùng đã được thiết lập chiều cao. Không thể thiết lập lại.');
    if (!Number.isInteger(mm) || mm < 100 || mm > 4000) throw new Error('Nhập chiều cao từ 10 đến 400 cm.');
    const client = clientRef.current;
    if (!client?.connected || !connected) throw new Error('Kết nối thiết bị trước khi lưu thiết lập.');
    const requestId = `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const command = heightCommand(requestId, mm, readings[bin.id], Date.now());
    await requests.current.send(requestId, bin.id, mm, failed => {
      client.publish(`${bin.topic}/config/set`, command, { qos: 0, retain: false }, failed);
    });
  }, [readings, connected]);
  useEffect(() => {
    if (!ready || !connected) return;
    for (const bin of bins) {
      const reading = readings[bin.id];
      const data = reading?.data;
      const mm = systemHeightToApply(bin, reading, connected, now);
      if (mm === null) continue;
      const key = `${broker}|${bin.id}|${data!.settings_session}|${mm}`;
      const previous = heightSyncAttempts.current.get(key);
      if (previous && (previous.count >= 3 || now - previous.at < 15000)) continue;
      heightSyncAttempts.current.set(key, { count: (previous?.count ?? 0) + 1, at: now });
      void saveHeight(bin, mm).catch(() => {
        setError(`Chưa đồng bộ được chiều cao cho ${bin.name}. Kiểm tra kết nối thiết bị.`);
      });
    }
  }, [ready, connected, bins, readings, broker, now, saveHeight]);
  return { bins,setBins,broker,readings,connected,ready,error: brokerConfig.error || error,now,saveHeight };
}
