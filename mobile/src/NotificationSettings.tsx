import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { useNotifications } from './useNotifications';

export function NotificationSettings({ state }: { state: ReturnType<typeof useNotifications> }) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const modeLabel = { off: 'Chưa bật', local: 'Khi app đang nhận dữ liệu', push: 'Kể cả khi đóng app' }[state.settings.mode];
  const disabled = state.busy || !state.loaded || !state.supported;
  const button = (title: string, onPress: () => void, blocked = disabled) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: blocked }} disabled={blocked} onPress={onPress} style={[s.button, blocked && s.disabled]}><Text style={s.buttonText}>{title}</Text></Pressable>;
  return <>
    <View style={s.card}>
      <Text style={s.heading}>Thông báo</Text>
      <Text style={s.body}>{modeLabel}</Text>
      {!!state.error && <Text accessibilityRole="alert" style={s.error}>{state.error}</Text>}
      {button('Thiết lập thông báo', () => { setAddress(state.settings.serverUrl); setCode(''); setOpen(true); }, !state.loaded)}
    </View>
    <Modal visible={open} animationType="slide" onRequestClose={() => { if (!state.busy) { setOpen(false); setCode(''); } }}>
      <SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Thông báo thùng rác</Text>
          <Text style={s.body}>Nhận nhắc nhở khi thùng đầy hoặc có mùi hôi. Chỉ báo khi trạng thái thay đổi, không lặp lại mỗi lần cập nhật.</Text>
          <Text style={s.status}>{modeLabel}</Text>
          {!state.supported && <Text style={s.body}>Dùng ứng dụng trên điện thoại để nhận thông báo. Bản web vẫn hiển thị cảnh báo trong danh sách.</Text>}
          <View style={s.card}>
            <Text style={s.heading}>Khi đang mở app</Text>
            <Text style={s.body}>Thông báo xuất hiện khi ứng dụng đang nhận dữ liệu. Có thể thử ngay với Expo Go.</Text>
            {button('Bật khi đang mở app', () => { void state.enableLocal(); })}
          </View>
          <View style={s.card}>
            <Text style={s.heading}>Kể cả khi đóng app</Text>
            <Text style={s.body}>Dịch vụ theo dõi thùng sẽ gửi thông báo đến điện thoại. Điện thoại cần Internet và quyền thông báo.</Text>
            {!state.supportsPush && <Text style={s.note}>Cần cài bản ứng dụng riêng để sử dụng. Expo Go chỉ hỗ trợ chế độ phía trên.</Text>}
            <Text style={s.label}>Địa chỉ dịch vụ thông báo</Text>
            <TextInput accessibilityLabel="Địa chỉ dịch vụ thông báo" editable={!state.busy} value={address} onChangeText={setAddress} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://…" placeholderTextColor="#53685F" style={s.input}/>
            <Text style={s.label}>Mã kết nối</Text>
            <TextInput accessibilityLabel="Mã kết nối dịch vụ thông báo" editable={!state.busy} value={code} onChangeText={setCode} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder={state.settings.mode === 'push' ? 'Để trống để giữ kết nối hiện tại' : 'Mã được cung cấp khi thiết lập dịch vụ'} placeholderTextColor="#53685F" style={s.input}/>
            {button('Bật kể cả khi đóng app', () => { void state.enablePush(address, code).then(saved => { if (saved) setCode(''); }); }, disabled || !state.supportsPush)}
            {state.settings.mode === 'push' && button('Đồng bộ lại danh sách thùng', state.sync)}
          </View>
          {state.busy && <View accessibilityLiveRegion="polite" style={s.wait}><ActivityIndicator/><Text style={s.body}>Đang cập nhật thông báo…</Text></View>}
          {!!state.error && <Text accessibilityRole="alert" style={s.error}>{state.error}</Text>}
          {!!state.message && <Text accessibilityLiveRegion="polite" style={s.success}>{state.message}</Text>}
          {button('Gửi thông báo thử', () => { void state.test(); })}
          {state.settings.mode !== 'off' && button('Tắt thông báo', () => { void state.disable(); })}
          <Text style={s.note}>Bấm vào thông báo để mở chi tiết thùng. Thông báo thử chỉ kiểm tra trên điện thoại, không xác nhận đường gửi khi app đóng.</Text>
          <Pressable accessibilityRole="button" disabled={state.busy} onPress={() => { setOpen(false); setCode(''); }} style={s.button}><Text style={s.buttonText}>Hoàn tất</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView></SafeAreaView>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F6F3' }, flex: { flex: 1 },
  page: { padding: 22, paddingBottom: 40, gap: 18, width: '100%', maxWidth: 700, alignSelf: 'center' },
  card: { padding: 20, gap: 14, backgroundColor: 'white', borderRadius: 22, borderWidth: 1, borderColor: '#D8E2DB' },
  title: { fontSize: 28, fontWeight: '800', color: '#183B30' }, heading: { fontSize: 19, fontWeight: '700', color: '#183B30' },
  label: { fontSize: 16, fontWeight: '600', color: '#183B30' }, body: { fontSize: 16, lineHeight: 24, color: '#53685F' }, note: { fontSize: 14, lineHeight: 22, color: '#53685F' },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#D8E2DB', padding: 14, borderRadius: 12, fontSize: 16, color: '#183B30' },
  button: { minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: '#166447', alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700', color: 'white' }, disabled: { opacity: 0.5 },
  status: { fontSize: 16, fontWeight: '600', color: '#166447' }, wait: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  error: { color: '#A33526', backgroundColor: '#FFF0EB', padding: 14, borderRadius: 12, fontSize: 16, lineHeight: 24 },
  success: { color: '#166447', backgroundColor: '#E1F1E7', padding: 14, borderRadius: 12, fontSize: 16, lineHeight: 24 },
});
