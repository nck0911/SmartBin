import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'warning' | 'danger';
  details?: { label: string; value: string }[];
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationDialog({ visible, title, description, confirmLabel, cancelLabel = 'Hủy', tone = 'warning', details, confirmDisabled = false, onConfirm, onCancel }: Props) {
  return <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onCancel}>
    <View style={styles.backdrop}>
      <SafeAreaView style={styles.safe}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <ScrollView bounces={false} contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {!!details?.length && <View style={styles.details}>
              {details.map(detail => <View key={detail.label} style={styles.detail}>
                <Text style={styles.label}>{detail.label}</Text>
                <Text style={styles.value}>{detail.value}</Text>
              </View>)}
            </View>}
            <Text style={styles.description}>{description}</Text>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: confirmDisabled }} disabled={confirmDisabled} onPress={onConfirm} style={({ pressed }) => [styles.button, styles.confirm, tone === 'danger' && styles.danger, confirmDisabled && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(12, 31, 23, 0.56)' },
  safe: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 420, maxHeight: '100%', flexShrink: 1, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#D8E2DB', overflow: 'hidden' },
  content: { padding: 24, gap: 18 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: '#183B30' },
  description: { fontSize: 16, lineHeight: 24, color: '#53685F' },
  details: { padding: 16, gap: 14, borderRadius: 16, backgroundColor: '#F3F6F3' },
  detail: { gap: 4 }, label: { fontSize: 14, lineHeight: 20, color: '#53685F' },
  value: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: '#183B30' },
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 12, padding: 20, paddingTop: 0 },
  button: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: '#DCECE3' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#183B30', textAlign: 'center' },
  confirm: { backgroundColor: '#166447' }, danger: { backgroundColor: '#A33526' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  pressed: { opacity: 0.7 }, disabled: { opacity: 0.5 },
});
