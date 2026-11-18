import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Bin, Reading } from './model';
import { parseHeight } from './heightSettings';
import { ConfirmationDialog } from './components/ConfirmationDialog';

type Props = { bin: Bin; reading?: Reading; connected: boolean; now: number; saveHeight: (bin: Bin, mm: number) => Promise<void> };

export function BinHeightSettings({ bin, reading, connected, now, saveHeight }: Props) {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmationMm, setConfirmationMm] = useState<number | null>(null);
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const data = reading?.data;
  const supported = !!data?.settings_session;
  const live = connected && !!reading?.liveAt && now - reading.liveAt <= 15000 && reading.availability !== 'offline';
  const locked = saved || data?.configured === true;
  const unavailable = locked || !supported || !live;
  const needsSetup = data?.configured === false && supported && !saved;

  function show() {
    if (!needsSetup) return;
    setHeight(data?.bin_height_cm?.toString() ?? bin.heightCm?.toString() ?? '');
    setError(''); setSuccess(''); setSaved(false); setOpen(true);
  }
  function submit() {
    if (pending || unavailable || confirmationMm !== null) return;
    const mm = parseHeight(height);
    if (mm === null) { setError('Nhập chiều cao từ 10 đến 400 cm, tối đa 1 chữ số thập phân.'); return; }
    Keyboard.dismiss();
    setConfirmationMm(mm);
  }
  async function persist(mm: number) {
    if (saving.current || unavailable) return;
    saving.current = true;
    setPending(true); setError(''); setSuccess('');
    try {
      await saveHeight(bin, mm);
      if (mounted.current) {
        setSuccess('Đã cập nhật chiều cao thùng.');
        setSaved(true);
      }
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : 'Chưa lưu được thiết lập. Vui lòng thử lại.');
    } finally { saving.current = false; if (mounted.current) setPending(false); }
  }
  if (bin.heightSource === 'system' || (!needsSetup && !open)) return null;
  return <>
    {needsSetup && <View style={styles.card}>
      <Text style={styles.heading}>Thiết lập thùng</Text>
      <Text style={styles.body}>Nhập chiều cao thùng để xem mức đầy. Bạn chỉ cần thiết lập một lần.</Text>
      {bin.heightCm !== undefined && <Text style={styles.body}>Chiều cao từ QR: {bin.heightCm} cm. Kiểm tra số đo trước khi xác nhận lưu trên thiết bị.</Text>}
      <Pressable accessibilityRole="button" onPress={show} style={styles.button}><Text style={styles.buttonText}>Thiết lập</Text></Pressable>
    </View>}
    <Modal visible={open} animationType="slide" onRequestClose={() => { if (confirmationMm !== null) setConfirmationMm(null); else if (!pending) setOpen(false); }}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
            <Text style={styles.title}>Thiết lập thùng</Text>
            <Text style={styles.body}>{bin.name}</Text>
            <Text style={styles.label}>Chiều cao bên trong thùng (cm)</Text>
            <TextInput accessibilityLabel="Chiều cao bên trong thùng, đơn vị cm" placeholder="Ví dụ: 45" placeholderTextColor="#53685F" keyboardType="decimal-pad" value={height} editable={!pending && !locked} onChangeText={value => { setHeight(value); setError(''); setSuccess(''); setSaved(false); }} style={styles.input}/>
            <Text style={styles.body}>Đo từ mặt dưới nắp khi đóng đến đáy bên trong thùng.</Text>
            <View accessible accessibilityLabel="Minh họa: cảm biến gắn dưới nắp, hướng xuống đáy; chiều cao đo từ mặt dưới nắp đóng đến đáy bên trong thùng." style={styles.diagram}>
              <View style={styles.lid}/>
              <View style={styles.sensor}/>
              <View style={styles.bin}><Text style={styles.arrow}>↕</Text><Text style={styles.diagramLabel}>Chiều cao bên trong</Text></View>
              <Text style={styles.note}>Cảm biến dưới nắp · Hướng xuống đáy</Text>
            </View>
            <Text style={styles.note}>Chiều cao chỉ được thiết lập một lần và lưu trên thiết bị. Hãy kiểm tra số đo trước khi lưu.</Text>
            {locked && !saved && <Text style={styles.success}>Thùng đã có chiều cao {data?.bin_height_cm} cm. Không cần thiết lập lại.</Text>}
            {unavailable && !locked && <Text style={styles.warning}>{!data ? 'Chờ thiết bị gửi dữ liệu để lưu thiết lập.' : !supported ? 'Cập nhật firmware của thiết bị để sử dụng thiết lập chiều cao.' : 'Thiết bị chưa cập nhật dữ liệu. Kiểm tra kết nối rồi thử lại.'}</Text>}
            {pending && <View accessibilityLiveRegion="polite" style={styles.wait}><ActivityIndicator/><Text style={styles.body}>Đang chờ thiết bị xác nhận…</Text></View>}
            {!!error && <Text accessibilityRole="alert" style={styles.warning}>{error}</Text>}
            {!!success && <Text accessibilityLiveRegion="polite" style={styles.success}>{success}</Text>}
            {!locked && <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending || unavailable, busy: pending }} disabled={pending || unavailable} onPress={submit} style={[styles.button, (pending || unavailable) && styles.disabled]}><Text style={styles.buttonText}>{pending ? 'Đang lưu…' : 'Lưu thiết lập'}</Text></Pressable>}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending }} disabled={pending} onPress={() => setOpen(false)} style={[styles.secondary, pending && styles.disabled]}><Text style={styles.label}>{locked ? 'Hoàn tất' : 'Quay lại'}</Text></Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
        <ConfirmationDialog
          visible={confirmationMm !== null}
          title="Xác nhận chiều cao thùng"
          description="Bạn chỉ có thể thiết lập một lần và không thể sửa chiều cao trong ứng dụng sau khi lưu. Hãy kiểm tra lại số đo trước khi xác nhận."
          details={[
            { label: 'Thùng rác', value: bin.name },
            { label: 'Chiều cao bên trong', value: `${(confirmationMm ?? 0) / 10} cm` },
          ]}
          cancelLabel="Kiểm tra lại"
          confirmLabel="Xác nhận lưu"
          confirmDisabled={unavailable || pending}
          onCancel={() => setConfirmationMm(null)}
          onConfirm={() => {
            const mm = confirmationMm;
            setConfirmationMm(null);
            if (mm !== null) void persist(mm);
          }}
        />
      </SafeAreaView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F6F3' }, flex: { flex: 1 },
  page: { width: '100%', maxWidth: 700, alignSelf: 'center', padding: 22, paddingBottom: 40, gap: 18 },
  card: { backgroundColor: 'white', borderRadius: 22, padding: 22, gap: 12, borderWidth: 1, borderColor: '#D8E2DB' },
  title: { fontSize: 30, fontWeight: '800', color: '#183B30' }, heading: { fontSize: 19, fontWeight: '700', color: '#183B30' },
  body: { fontSize: 16, lineHeight: 24, color: '#53685F' }, label: { fontSize: 16, fontWeight: '600', color: '#183B30' },
  note: { fontSize: 14, lineHeight: 22, color: '#53685F', textAlign: 'center' },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#D8E2DB', borderRadius: 12, padding: 14, fontSize: 18, color: '#183B30', backgroundColor: 'white' },
  button: { minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: '#166447', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 }, secondary: { minHeight: 48, padding: 14, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 }, warning: { fontSize: 16, lineHeight: 24, color: '#A33526', backgroundColor: '#FFF0EB', padding: 14, borderRadius: 12 },
  success: { fontSize: 16, lineHeight: 24, color: '#166447', backgroundColor: '#E1F1E7', padding: 14, borderRadius: 12 },
  wait: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  diagram: { padding: 20, borderRadius: 16, backgroundColor: '#E1F1E7', alignItems: 'center', gap: 6 },
  lid: { width: 164, height: 6, backgroundColor: '#183B30', borderRadius: 3 }, sensor: { width: 24, height: 8, backgroundColor: '#166447' },
  bin: { width: 150, minHeight: 130, borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 3, borderColor: '#53685F', alignItems: 'center', justifyContent: 'center', padding: 10 },
  arrow: { fontSize: 42, color: '#166447' }, diagramLabel: { fontSize: 14, color: '#183B30', textAlign: 'center' },
});
