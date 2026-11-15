export function processReading(store, device, raw, retained, now = Date.now()) {
  if (retained) return;
  let d;
  try { d = JSON.parse(raw); } catch { return; }
  if (!d || d.schema !== 1 || d.device_id !== device.id) return;
  if (d.configured === true && d.trash_valid === true && d.trash_stale === false &&
      typeof d.full === 'boolean' && Number.isFinite(d.fill_percent) && d.fill_percent >= 0 && d.fill_percent <= 100) {
    store.transition(device.id, device.topic, 'full', d.full, now);
  }
  if (d.gas_valid === true && typeof d.gas_high === 'boolean' && Number.isInteger(d.gas_adc) && d.gas_adc >= 0 && d.gas_adc <= 4095) {
    store.transition(device.id, device.topic, 'odor', d.gas_high, now);
  }
}
export function pushMessage(job, token, brokerUrl) {
  return {
    to: token, sound: 'default', channelId: 'trash-alerts-v2', priority: 'high', ttl: 300,
    title: job.kind === 'full' ? 'Thùng rác đã đầy' : 'Thùng rác có mùi hôi',
    body: job.kind === 'full' ? `${job.name} cần được thu gom.` : `${job.name} cần được kiểm tra và vệ sinh.`,
    data: { type: 'trash-alert', binId: job.device, topic: job.topic, brokerUrl, kind: job.kind, eventId: job.id, demo: false },
  };
}
