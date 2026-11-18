import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Reading } from '../model';
import { batteryStatus } from '../battery';

export function BatteryStatus({ reading, connected, now }: { reading?: Reading; connected: boolean; now: number }) {
  const battery = batteryStatus(reading, connected, now);
  const color = battery.level === 'critical' ? '#A33526' : battery.level === 'low' ? '#965B12' : battery.level === 'unknown' ? '#53685F' : '#166447';
  const warning = battery.percent === 0 ? 'Hết pin' : battery.level === 'critical' || battery.level === 'low' ? 'Pin yếu' : '';
  return <View style={s.row} accessible accessibilityLabel={`Pin ${battery.percent === null ? 'chưa có dữ liệu' : `${battery.percent}%`}${warning ? `, ${warning}` : ''}`}>
    <View style={s.icon}>
      <View style={[s.body, { borderColor: color }]}>{battery.percent !== null && <View style={[s.fill, { width: `${battery.percent}%`, backgroundColor: color }]} />}</View>
      <View style={[s.cap, { backgroundColor: color }]} />
    </View>
    <Text style={[s.text, { color }]}>{battery.percent === null ? '—' : `${battery.percent}%`}</Text>
  </View>;
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 24, flexShrink: 0 },
  icon: { flexDirection: 'row', alignItems: 'center' },
  body: { width: 22, height: 12, borderWidth: 1.5, borderRadius: 3, padding: 1.5, justifyContent: 'center' },
  fill: { height: '100%', borderRadius: 1 },
  cap: { width: 2, height: 5, marginLeft: 1, borderRadius: 1 },
  text: { fontSize: 13, fontWeight: '600' },
});
