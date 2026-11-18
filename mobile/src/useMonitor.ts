import { useEffect, useMemo, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mqtt from 'mqtt';
import { AppState } from 'react-native';
import { Bin, Reading, decode, initialBin, validHeightCm } from './model';
import { HeightRequests, heightCommand } from './heightSettings';
import { mqttBrokerUrl } from './brokerConfig';

export function useMonitor() {
  const [bins, setBins] = useState<Bin[]>([]);
  const brokerConfig = useMemo(() => {
    try { return { url: mqttBrokerUrl(process.env.EXPO_PUBLIC_MQTT_URL), error: '' }; }
    catch (reason) { return { url: '', error: reason instanceof Error ? reason.message : 'Không đọc được cấu hình kết nối dữ liệu.' }; }
  }, []);
  const [broker, setBroker] = useState(brokerConfig.url);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const [active, setActive] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const clientRef = useRef<ReturnType<typeof mqtt.connect> | null>(null);
  const requests = useRef(new HeightRequests());
  const [demoHeights, setDemoHeights] = useState<Record<string, number>>({});
  const scope = useMemo(() => ({ ready, active, demo, bins, broker, demoHeights }), [ready, active, demo, bins, broker, demoHeights]);
  const [stream, setStream] = useState<{ scope: typeof scope | null; connected: boolean; readings: Record<string, Reading> }>({ scope: null, connected: false, readings: {} });
  // A new session immediately hides previous readings, without an effect-driven reset render.
  const connected = stream.scope === scope && stream.connected;
  const readings = stream.scope === scope ? stream.readings : {};
  useEffect(() => {
    AsyncStorage.getItem('smartbin-monitor-v1').then(raw => {
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.bins) && saved.bins.every((b: Bin) => b && ['id','name','location','topic'].every(k => typeof (b as any)[k] === 'string'))) {
        // Remove only the untouched legacy sample once; preserve manually named bins.
        setBins(saved.bins.filter((b: Bin) => saved.onboardingVersion === 2 ||
          !(b.id === initialBin.id && b.topic === initialBin.topic && b.location === initialBin.location &&
            [initialBin.name, 'Thùng rác nhóm 10'].includes(b.name))).map((b: Bin) => {
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
    const { ready, active, demo, bins, broker, demoHeights } = scope;
    function setConnected(value: boolean) {
      setStream(old => ({ scope, connected: value, readings: old.scope === scope ? old.readings : {} }));
    }
    function setReadings(update: SetStateAction<Record<string, Reading>>) {
      setStream(old => ({ scope, connected: old.scope === scope && old.connected, readings: typeof update === 'function' ? update(old.scope === scope ? old.readings : {}) : update }));
    }
    if (!ready || !active || !broker) return;
    if (demo) {
      const update = () => {
        const at = Date.now();
        setReadings(Object.fromEntries(bins.map((b, i) => {
          const height = (demoHeights[b.id] ?? 450) / 10;
          const fill = Math.max(0, Math.min(100, 100 * (height - (i % 2 ? 10 : 25)) / (height - 5)));
          return [b.id, { availability: 'online', receivedAt: at, liveAt: at, data: { schema: 1, device_id: b.id, configured: true, bin_height_cm: height, settings_session: 1, fill_percent: fill, gas_adc: i % 2 ? 2300 : 1200, trash_valid: true, trash_stale: false, gas_valid: true, full: fill >= 80, gas_high: !!(i % 2), lid_command: 'closed', uptime_ms: at % 1000000 } }];
        })));
      };
      const first = setTimeout(() => { setConnected(true); update(); }, 0);
      const timer = setInterval(update, 2000);
      return () => { clearTimeout(first); clearInterval(timer); };
    }
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
  async function saveHeight(bin: Bin, mm: number) {
    if (readings[bin.id]?.data?.configured) throw new Error('Thùng đã được thiết lập chiều cao. Không thể thiết lập lại.');
    if (!Number.isInteger(mm) || mm < 100 || mm > 4000) throw new Error('Nhập chiều cao từ 10 đến 400 cm.');
    if (demo) { setDemoHeights(old => ({ ...old, [bin.id]: mm })); return; }
    const client = clientRef.current;
    if (!client?.connected || !connected) throw new Error('Kết nối thiết bị trước khi lưu thiết lập.');
    const requestId = `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const command = heightCommand(requestId, mm, readings[bin.id], Date.now());
    await requests.current.send(requestId, bin.id, mm, failed => {
      client.publish(`${bin.topic}/config/set`, command, { qos: 0, retain: false }, failed);
    });
  }
  return { bins,setBins,broker,setBroker,readings,connected,ready,error: brokerConfig.error || error,demo,setDemo,now,saveHeight };
}
