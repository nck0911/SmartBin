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
  if (d.battery_valid === true && Number.isInteger(d.battery_percent) && d.battery_percent >= 0 && d.battery_percent <= 100 &&
      typeof d.battery_low === 'boolean' && typeof d.battery_critical === 'boolean' && (!d.battery_critical || d.battery_low)) {
    store.transition(device.id, device.topic, 'battery_low', d.battery_low, now, !d.battery_critical);
    store.transition(device.id, device.topic, 'battery_critical', d.battery_critical, now);
  }
}
export function pushMessage(job, token, brokerUrl) {
  const titles = { full: 'Thùng rác đã đầy', odor: 'Thùng rác có mùi hôi', battery_low: 'Pin thùng rác yếu', battery_critical: 'Pin thùng rác sắp hết' };
  const body = job.kind === 'full' ? `${job.name} cần được thu gom.` : job.kind === 'odor' ? `${job.name} cần được kiểm tra và vệ sinh.` : `${job.name} cần được sạc hoặc thay pin.`;
  return {
    to: token, sound: 'default', channelId: 'smartbin-alerts-v1', priority: 'high', ttl: 300,
    title: titles[job.kind] || 'Cảnh báo thùng rác',
    body,
    data: { type: 'smartbin-alert', binId: job.device, topic: job.topic, brokerUrl, kind: job.kind, eventId: job.id, demo: false },
  };
}
