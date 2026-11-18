import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { useNotifications } from './useNotifications';

type Props = { state: ReturnType<typeof useNotifications>; alertsOnly: boolean; onAlertsOnlyChange: (value: boolean) => void; showAlertFilter: boolean };
export function NotificationSettings({ state, alertsOnly, onAlertsOnlyChange, showAlertFilter }: Props) {
  const disabled = state.busy || !state.loaded || !state.supported;
  return <View style={s.section}>
    <Text style={s.heading}>Cài đặt</Text>
    <View style={s.card}>
    <View style={s.row}>
      <Text style={s.label}>Bật thông báo đẩy</Text>
      <Switch accessibilityLabel="Bật thông báo đẩy" disabled={disabled} value={state.settings.mode === 'push'}
        onValueChange={enabled => { void (enabled ? state.enableNotifications() : state.disable()); }}
        trackColor={{ false: '#D8E2DB', true: '#166447' }} thumbColor="#FFFFFF" />
    </View>
    {showAlertFilter && <View style={[s.row, s.filterRow]}>
      <Text style={s.label}>Chỉ hiện thùng có cảnh báo</Text>
      <Switch accessibilityLabel="Chỉ hiện thùng có cảnh báo" value={alertsOnly} onValueChange={onAlertsOnlyChange}
        trackColor={{ false: '#D8E2DB', true: '#166447' }} thumbColor="#FFFFFF" />
    </View>}
    {!!state.error && <Text accessibilityRole="alert" style={s.error}>{state.error}</Text>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  section: { gap: 12 },
  card: { padding: 20, gap: 14, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#D8E2DB' },
  heading: { fontSize: 19, fontWeight: '700', color: '#183B30' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 48 },
  label: { flex: 1, fontSize: 16, color: '#183B30' },
  filterRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E1E8E3', paddingTop: 14 },
  error: { color: '#A33526', fontSize: 14, lineHeight: 20 },
});
