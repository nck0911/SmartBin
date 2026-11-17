import React, { useRef, useState } from 'react';
import { AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseBinQr } from '../binQr';
import type { Bin } from '../model';

export function BinQrScanner({ onScan, onClose }: { onScan: (bin: Bin) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const [active, setActive] = useState(AppState.currentState === 'active');
  const locked = useRef(false);
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  function scan(raw: string) {
    if (locked.current) return;
    locked.current = true;
    try { onScan(parseBinQr(raw)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không đọc được mã QR.'); }
  }
  return <Modal animationType="slide" onRequestClose={onClose}><SafeAreaView style={s.page}>
    <Text style={s.title}>Quét QR trên thùng</Text>
    <Text style={s.text}>Đưa mã QR của thiết bị vào khung hình để thêm thùng.</Text>
    {!permission ? <Text style={s.text}>Đang kiểm tra quyền camera…</Text> : !permission.granted ? <View style={s.message}>
      <Text style={s.text}>Cho phép dùng camera để quét mã QR.</Text>
      <Action title={permission.canAskAgain ? 'Cho phép camera' : 'Mở cài đặt quyền camera'} onPress={() => {
        const action = permission.canAskAgain ? requestPermission() : Linking.openSettings();
        action.catch(() => setError('Không mở được camera. Bạn có thể quay lại và nhập thông tin thủ công.'));
      }}/>
    </View> : active && !error ? <CameraView style={s.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => scan(data)} onMountError={() => setError('Không mở được camera. Kiểm tra quyền camera hoặc nhập thông tin thủ công.')}/> : null}
    {!!error && <View style={s.message}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Action title="Quét lại" onPress={() => { locked.current = false; setError(''); }}/></View>}
    <Action title="Quay lại" onPress={onClose}/>
  </SafeAreaView></Modal>;
}
function Action({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.button, { opacity: pressed ? 0.6 : 1 }]}><Text style={s.buttonText}>{title}</Text></Pressable>;
}
const s = StyleSheet.create({
  page: { flex: 1, padding: 22, gap: 18, backgroundColor: '#F3F6F3' },
  title: { fontSize: 26, fontWeight: '800', color: '#183B30' },
  text: { fontSize: 16, lineHeight: 24, color: '#53685F' },
  camera: { flex: 1, minHeight: 240, borderRadius: 20, overflow: 'hidden' },
  message: { flex: 1, justifyContent: 'center', gap: 18 },
  error: { color: '#A33526', fontSize: 16, lineHeight: 24 },
  button: { minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: '#166447', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
