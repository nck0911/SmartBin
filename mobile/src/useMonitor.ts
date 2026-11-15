import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mqtt from 'mqtt';
import { AppState } from 'react-native';
import { Bin, Reading, decode, initialBin } from './model';

export function useMonitor() {
  const [bins, setBins] = useState<Bin[]>([initialBin]);
  const [broker, setBroker] = useState('wss://broker.hivemq.com:8884/mqtt');
  const [readings, setReadings] = useState<Record<string, Reading>>({});
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const [active, setActive] = useState(true);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    AsyncStorage.getItem('trash-monitor-v1').then(raw => {
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.bins) && saved.bins.every((b: Bin) => b && ['id','name','location','topic'].every(k => typeof (b as any)[k] === 'string')) && typeof saved.broker === 'string' && /^wss:\/\//.test(saved.broker)) {
        setBins(saved.bins); setBroker(saved.broker);
      }
    }).catch(() => setError('Không đọc được cấu hình đã lưu.')).finally(() => setReady(true));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  useEffect(() => {
    if (ready) AsyncStorage.setItem('trash-monitor-v1', JSON.stringify({ bins, broker })).catch(() => setError('Không lưu được cấu hình.'));
  }, [ready, bins, broker]);
  useEffect(() => {
    setReadings({}); setConnected(false);
    if (!ready || !active) return;
    if (demo) {
      const update = () => {
        const at = Date.now();
        setReadings(Object.fromEntries(bins.map((b, i) => [b.id, { availability: 'online', receivedAt: at, liveAt: at, data: { schema: 1, device_id: b.id, fill_percent: i % 2 ? 87 : 46, gas_adc: i % 2 ? 2300 : 1200, trash_valid: true, trash_stale: false, gas_valid: true, full: !!(i % 2), gas_high: !!(i % 2), lid_command: 'closed', uptime_ms: at % 1000000 } }])));
      };
      setConnected(true); update(); const timer = setInterval(update, 2000);
      return () => clearInterval(timer);
    }
    const client = mqtt.connect(broker, { clientId: `trash_app_${Math.random().toString(16).slice(2)}`, clean: true, reconnectPeriod: 3000, connectTimeout: 10000, forceNativeWebSocket: true });
    client.on('connect', () => {
      setConnected(true); setError('');
      const topics = bins.flatMap(b => ['state','events','availability'].map(s => `${b.topic}/${s}`));
      if (topics.length) client.subscribe(topics, err => { if (err) setError('Không đăng ký được topic MQTT.'); });
    });
    client.on('offline', () => setConnected(false));
    client.on('close', () => { setConnected(false); setReadings(old => Object.fromEntries(Object.entries(old).map(([id,r]) => [id,{...r,liveAt: undefined}]))); });
    client.on('error', () => setError('Không kết nối được MQTT. Đang thử lại…'));
    client.on('message', (topic, payload, packet) => {
      const b = bins.find(b => ['state','events','availability'].some(s => topic === `${b.topic}/${s}`));
      if (!b) return;
      const raw = payload.toString();
      if (topic.endsWith('/availability')) {
        if (raw === 'online' || raw === 'offline') setReadings(old => ({...old,[b.id]: {...old[b.id],availability: raw}}));
        return;
      }
      const data = decode(raw, b.id);
      if (!data) return;
      const at = Date.now();
      setReadings(old => ({...old,[b.id]: {...old[b.id], data, receivedAt: at, liveAt: packet.retain ? old[b.id]?.liveAt : at}}));
    });
    return () => { client.removeAllListeners(); client.end(true); };
  }, [ready, active, demo, bins, broker]);
  return { bins,setBins,broker,setBroker,readings,connected,ready,error,demo,setDemo,now };
}
