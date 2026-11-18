import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView } from 'expo-camera';
import { parseBinQr } from '../binQr';
import type { Bin } from '../model';

export function BinQrScanner({ onScan, onClose }: { onScan: (bin: Bin) => void; onClose: () => void }) {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const [ready, setReady] = useState(false);
  const locked = useRef(false);
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state !== 'active') setReady(false);
    });
    return () => sub.remove();
  }, []);
  function scan(raw: string) {
    if (locked.current) return;
    locked.current = true;
    let bin: Bin;
    try { bin = parseBinQr(raw); }
    catch (e) {
      Alert.alert('Không đọc được mã QR', e instanceof Error ? e.message : 'Mã QR không hợp lệ.', [
        { text: 'Quét lại', onPress: () => { locked.current = false; } },
        { text: 'Quay lại', style: 'cancel', onPress: onClose },
      ]);
      return;
    }
    onScan(bin);
  }
  return <Modal animationType="slide" onRequestClose={onClose}><View style={s.page}>
    {active && <CameraView style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => scan(data)} onMountError={() => {
      if (locked.current) return;
      locked.current = true;
      Alert.alert('Không mở được camera', 'Kiểm tra quyền camera rồi thử lại.', [{ text: 'Quay lại', onPress: onClose }]);
    }}/>}
    {!ready && <View pointerEvents="none" style={s.loading}><ActivityIndicator color="#FFFFFF" accessibilityLabel="Đang mở camera" /></View>}
    <SafeAreaView pointerEvents="box-none" style={s.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onClose} style={({ pressed }) => [s.back, { opacity: pressed ? 0.6 : 1 }]}>
        <View accessible={false} style={s.chevron}/>
      </Pressable>
    </SafeAreaView>
  </View></Modal>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, paddingHorizontal: 10 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 12, height: 12, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#FFFFFF', transform: [{ rotate: '45deg' }] },
});
