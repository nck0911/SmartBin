import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Camera } from "expo-camera";
import { Bin, Reading, status, validateBin } from "./src/model";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMonitorContext } from "./src/MonitorContext";
import { BinHeightSettings } from "./src/BinHeightSettings";
import { NotificationSettings } from "./src/NotificationSettings";
import { BinQrScanner } from "./src/components/BinQrScanner";
import { ConfirmationDialog } from "./src/components/ConfirmationDialog";
import { verifyBin } from "./src/verifyBin";
import { BatteryStatus } from "./src/components/BatteryStatus";
import { batteryStatus } from "./src/battery";
const colors = {
  bg: "#F3F6F3",
  ink: "#183B30",
  muted: "#53685F",
  green: "#166447",
  pale: "#E1F1E7",
  red: "#A33526",
};
function Button({
  title,
  onPress,
  danger = false,
  secondary = false,
  fill = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  danger?: boolean;
  secondary?: boolean;
  fill?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        s.button,
        fill && s.actionButton,
        secondary && s.secondaryButton,
        danger && s.dangerButton,
        { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          secondary && s.secondaryText,
          danger && s.dangerText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChangeText,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  editable?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        editable={editable}
        accessibilityState={{ disabled: !editable }}
        onChangeText={onChangeText}
        style={[s.input, !editable && { backgroundColor: colors.pale, color: colors.muted }]}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
function Metrics({ reading, systemHeight = false }: { reading?: Reading; systemHeight?: boolean }) {
  const d = reading?.data;
  const valid = d?.configured && d.trash_valid && d.fill_percent !== null;
  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Text style={s.muted}>Mức đầy</Text>
        <Text style={s.value}>
          {valid ? `${Math.round(d.fill_percent!)}%` : "—"}
        </Text>
      </View>
      <View
        accessibilityLabel={`Mức đầy ${valid ? d.fill_percent : "chưa có dữ liệu"}`}
        style={s.track}
      >
        <View
          style={{
            height: 10,
            width: `${valid ? d.fill_percent : 0}%`,
            backgroundColor: d?.full ? colors.red : colors.green,
            borderRadius: 8,
          }}
        />
      </View>
      {d && !d.configured && !systemHeight && (
        <Text style={s.warning}>
          {d.settings_session
            ? "Nhập chiều cao thùng để xem mức đầy."
            : "Cập nhật firmware để thiết lập chiều cao thùng."}
        </Text>
      )}
      {d?.configured && d.trash_stale && (
        <Text style={s.warning}>
          Mức đầy là mẫu cũ, chờ đo lại khi nắp đóng.
        </Text>
      )}
      {d?.configured && !d.trash_valid && (
        <Text style={s.warning}>Cảm biến rác chưa có dữ liệu hợp lệ.</Text>
      )}
      <View style={s.row}>
        <Text style={s.muted}>Mức mùi</Text>
        <Text style={s.label}>
          {d?.gas_valid && d.gas_adc !== null
            ? d.gas_high
              ? "Cao"
              : "Bình thường"
            : "—"}
        </Text>
      </View>
      {d && !d.gas_valid && <Text style={s.warning}>Chưa có dữ liệu mùi.</Text>}
      {d?.configured && d.full && (
        <Text style={s.alert}>Cảnh báo đầy · Cần kiểm tra và thu gom</Text>
      )}
      {d?.gas_high && (
        <Text style={s.alert}>Có mùi hôi · Cần kiểm tra và vệ sinh thùng</Text>
      )}
    </View>
  );
}
export default function Monitor() {
  const { monitor: m, notifications, openBin } = useMonitorContext();
  const router = useRouter();
  const { id: selected } = useLocalSearchParams<{ id?: string }>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(false);
  const [form, setForm] = useState<Bin>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [editing, setEditing] = useState<string>();
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Bin>();
  const [scanning, setScanning] = useState(false);
  const openingScanner = useRef(false);
  async function openScanner() {
    if (openingScanner.current) return;
    openingScanner.current = true;
    try {
      let permission = await Camera.getCameraPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) permission = await Camera.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Chưa có quyền camera', 'Cho phép camera để quét mã QR thùng rác.', [
          { text: 'Để sau', style: 'cancel' },
          ...(!permission.canAskAgain ? [{ text: 'Mở cài đặt', onPress: () => { void Linking.openSettings().catch(() => setError('Không mở được cài đặt quyền camera.')); } }] : []),
        ]);
        return;
      }
      setError('');
      setScanning(true);
    } catch {
      Alert.alert('Không mở được camera', 'Không kiểm tra được quyền camera. Vui lòng thử lại.');
    } finally {
      openingScanner.current = false;
    }
  }
  const [fromQr, setFromQr] = useState(false);
  function scanned(b: Bin) {
    setScanning(false);
    const existing = m.bins.find((x) => x.id === b.id);
    if (existing) {
      setForm(undefined);
      if (existing.topic === b.topic) {
        void verifyBin(existing, m.broker, process.env.EXPO_PUBLIC_BACKEND_URL, fetch, __DEV__).then(result => {
          m.setBins(old => old.map(x => x.id === b.id ? { ...x, heightCm: result.heightCm, heightSource: 'system' } : x));
        }).catch(reason => Alert.alert('Không lấy được chiều cao thùng', reason instanceof Error ? reason.message : 'Vui lòng thử lại.'));
      }
      openBin(existing.id);
      return;
    }
    setEditing(undefined);
    setFromQr(true);
    setForm(b);
    setError("");
  }
  const bin = m.bins.find((b) => b.id === selected);
  const alerts = m.bins.filter(
    (b) =>
      (m.readings[b.id]?.data?.configured && m.readings[b.id]?.data?.full) ||
      m.readings[b.id]?.data?.gas_high ||
      ['low', 'critical'].includes(batteryStatus(m.readings[b.id], m.connected, m.now).level),
  );
  const visible = m.bins.filter(
    (b) =>
      `${b.name} ${b.location}`.toLowerCase().includes(query.toLowerCase()) &&
      (!filter || alerts.includes(b)),
  );
  function edit(b: Bin) {
    setFromQr(false);
    setEditing(b.id);
    setForm({ ...b });
    setError("");
  }
  async function save() {
    if (!form || savingRef.current) return;
    const original = editing ? m.bins.find((b) => b.id === editing) : undefined;
    if (editing && !original) {
      setError("Thùng này không còn trong danh sách theo dõi.");
      return;
    }
    const clean: Bin = original
      ? { ...original, name: form.name.trim(), location: form.location.trim() }
      : {
          id: form.id.trim(),
          topic: form.topic.trim(),
          name: form.name.trim(),
          location: form.location.trim(),
          ...(form.heightCm !== undefined ? { heightCm: form.heightCm } : {}),
        };
    const problem = validateBin(clean, m.bins, editing);
    if (problem) {
      setError(problem);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      if (!editing) {
        const verified = await verifyBin(clean, m.broker, process.env.EXPO_PUBLIC_BACKEND_URL, fetch, __DEV__);
        clean.heightCm = verified.heightCm;
        clean.heightSource = 'system';
      }
      m.setBins((old) =>
        editing
          ? old.map((b) =>
              b.id === editing
                ? { ...b, name: clean.name, location: clean.location }
                : b,
            )
          : [...old, clean],
      );
      setForm(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chưa xác minh được thùng. Vui lòng thử lại.');
    } finally { savingRef.current = false; setSaving(false); }
  }
  function remove() {
    if (bin) setDeleteTarget(bin);
  }
  function confirmRemove() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(undefined);
    m.setBins((old) => old.filter((b) => b.id !== id));
    router.back();
  }
  if (selected && m.ready && !bin)
    return (
      <SafeAreaView edges={["left", "right", "bottom"]} style={s.safe}>
        <View style={s.page}>
          <Text style={s.heading}>Không tìm thấy thùng</Text>
          <Text style={s.muted}>
            Thùng này không còn trong danh sách theo dõi.
          </Text>
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView
      edges={bin ? ["left", "right", "bottom"] : undefined}
      style={s.safe}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled"
      >
        {!bin && (
          <>
            <Image source={require('./assets/smartbin-logo.png')} style={s.brandLogo} resizeMode="contain" accessible accessibilityLabel="SmartBin" />
            <Text style={s.tagline}>Cho không gian sạch hơn mỗi ngày</Text>
          </>
        )}
        {!!m.error && <Text style={s.warning}>{m.error}</Text>}
        {!m.ready ? (
          <ActivityIndicator accessibilityLabel="Đang tải danh sách" />
        ) : bin ? (
          <>
            <View style={s.card}>
              <Text style={s.heading}>{bin.name}</Text>
              <Text style={s.muted}>{bin.location}</Text>
              <Text style={s.badge}>
                {status(m.readings[bin.id], m.connected, m.now)}
              </Text>
              <Metrics reading={m.readings[bin.id]} systemHeight={bin.heightSource === 'system'} />
            </View>
            <BinHeightSettings
              key={bin.id}
              bin={bin}
              reading={m.readings[bin.id]}
              connected={m.connected}
              now={m.now}
              saveHeight={m.saveHeight}
            />
            <View style={s.card}>
              <Text style={s.heading}>Thông tin thiết bị</Text>
              <Text style={s.muted}>
                Chiều cao thùng: {bin.heightSource === 'system' && bin.heightCm !== undefined ? `${bin.heightCm} cm` : m.readings[bin.id]?.data?.bin_height_cm != null ? `${m.readings[bin.id].data!.bin_height_cm} cm` : 'Chưa xác nhận'}
              </Text>
              <Text selectable style={s.muted}>
                Mã thiết bị: {bin.id}
              </Text>
              <Text selectable style={s.muted}>
                Đường dẫn dữ liệu: {bin.topic}
              </Text>
              <Text style={s.muted}>
                Nhận gần nhất:{" "}
                {m.readings[bin.id]?.receivedAt
                  ? new Date(m.readings[bin.id].receivedAt!).toLocaleString(
                      "vi-VN",
                    )
                  : "Chưa có"}
              </Text>
              <Text style={s.muted}>
                Trạng thái nắp:{" "}
                {m.readings[bin.id]?.data
                  ? m.readings[bin.id].data!.lid_command === "open"
                    ? "Mở"
                    : "Đóng"
                  : "Chưa có dữ liệu"}
              </Text>
              <Text style={s.note}>
                Lệnh nắp không phản ánh vị trí cơ khí thực tế. Kiểm tra thời
                gian cập nhật trước khi sử dụng dữ liệu và cảnh báo.
              </Text>
            </View>
            <View style={s.actions}>
              <Button title="Sửa thông tin" onPress={() => edit(bin)} fill />
              <Button title="Bỏ theo dõi" onPress={remove} danger fill />
            </View>
          </>
        ) : (
          <>
            <View style={s.summary}>
              <View>
                <Text style={s.summaryNumber}>
                  {m.bins.length.toString().padStart(2, "0")}
                </Text>
                <Text style={s.muted}>Thùng quản lý</Text>
              </View>
              <View>
                <Text
                  style={[
                    s.summaryNumber,
                    { color: alerts.length ? colors.red : colors.green },
                  ]}
                >
                  {alerts.length.toString().padStart(2, "0")}
                </Text>
                <Text style={s.muted}>Có cảnh báo</Text>
              </View>
            </View>
            <View style={s.row}>
              <Text style={s.heading}>Danh sách thùng</Text>
              <Button title="+ Thêm thùng rác" onPress={() => {
                setEditing(undefined);
                setFromQr(false);
                setForm({ id: "", name: "", location: "", topic: "" });
                setError("");
              }} />
            </View>
            <TextInput
              accessibilityLabel="Tìm thùng theo tên hoặc vị trí"
              placeholder="Tìm theo tên hoặc vị trí…"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={s.input}
            />
            {visible.map((b) => (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={`Xem ${b.name}`}
                onPress={() => openBin(b.id)}
                style={({ pressed }) => [
                  s.card,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <View style={s.row}>
                  <Text style={[s.heading, s.cardTitle]} numberOfLines={2}>{b.name}</Text>
                  <View style={s.cardActions}>
                    <BatteryStatus reading={m.readings[b.id]} connected={m.connected} now={m.now} />
                    <View accessible={false} style={s.cardChevron} />
                  </View>
                </View>
                <Text style={s.muted}>{b.location}</Text>
                <Text style={s.badge}>{status(m.readings[b.id], m.connected, m.now)}</Text>
                <Metrics reading={m.readings[b.id]} systemHeight={b.heightSource === 'system'} />
              </Pressable>
            ))}
            {!visible.length && (
              <View style={[s.card, s.emptyCard]}>
                <Text style={s.muted}>Hiện chưa có thùng rác nào</Text>
              </View>
            )}
          </>
        )}
        {!selected && <NotificationSettings state={notifications} alertsOnly={filter} onAlertsOnlyChange={setFilter} showAlertFilter />}
        <Text style={s.footer}>
          © {new Date().getFullYear()} SmartBin
        </Text>
      </ScrollView>
      {scanning && (
        <BinQrScanner onScan={scanned} onClose={() => setScanning(false)} />
      )}
      <ConfirmationDialog
        visible={!!deleteTarget}
        title="Xóa khỏi danh sách?"
        description="Thùng sẽ được xóa khỏi danh sách theo dõi của bạn. Thiết bị vẫn hoạt động và giữ nguyên thiết lập."
        details={[{ label: "Thùng rác", value: deleteTarget?.name ?? "" }]}
        tone="danger"
        confirmLabel="Xóa khỏi danh sách"
        onCancel={() => setDeleteTarget(undefined)}
        onConfirm={confirmRemove}
      />
      <Modal
        visible={!scanning && !!form}
        animationType="slide"
        onRequestClose={() => {
          if (savingRef.current) return;
          setForm(undefined);
        }}
      >
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              contentContainerStyle={s.page}
              keyboardShouldPersistTaps="handled"
            >
              <View style={s.formHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quay lại"
                disabled={saving}
                onPress={() => setForm(undefined)}
                style={({ pressed }) => [s.backButton, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View accessible={false} style={s.backChevron} />
              </Pressable>
              <Text style={[s.title, { flex: 1 }]}>
                {editing ? "Sửa thùng rác" : "Thêm thùng rác"}
              </Text>
              </View>
              <Text style={s.muted}>
                {editing
                    ? "Đặt tên và vị trí để dễ nhận biết thùng."
                    : "Mã thiết bị và đường dẫn dữ liệu cần khớp cấu hình của thùng."}
              </Text>
              {(
                form &&
                (editing
                  ? (["name", "location"] as const)
                  : (["name", "location", "id", "topic"] as const)
                ).map((key) => (
                  <Field
                    key={key}
                    label={
                      {
                        name: "Tên thùng",
                        location: "Vị trí",
                        id: "Mã thiết bị",
                        topic: "Đường dẫn dữ liệu",
                      }[key]
                    }
                    value={form[key]}
                    editable={!saving && (!!editing || !fromQr || key === "name" || key === "location")}
                    onChangeText={(v) => {
                      if (!saving && (editing || !fromQr || key === "name" || key === "location")) setForm({ ...form, [key]: v });
                    }}
                  />
                ))
              )}
              {!!error && (
                <Text accessibilityRole="alert" style={s.alert}>
                  {error}
                </Text>
              )}
              <View style={s.actions}>
                <Button
                  title={saving ? "Đang xác minh…" : editing ? "Lưu thay đổi" : "Lưu thông tin"}
                  disabled={saving}
                  fill
                  onPress={() => { void save(); }}
                />
                {!editing ? <Button
                  title="Quét QR"
                  disabled={saving}
                  secondary
                  fill
                  onPress={() => { void openScanner(); }}
                /> : null}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  emptyCard: { borderStyle: "dashed", borderColor: "#A8BBB0", backgroundColor: "transparent", alignItems: "center", paddingVertical: 32 },
  formHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: -12 },
  backButton: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  backChevron: { width: 11, height: 11, borderLeftWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.ink, transform: [{ rotate: "45deg" }] },
  actions: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  actionButton: { flex: 1, minWidth: 0, minHeight: 48 },
  dangerButton: {
    backgroundColor: "#FBE5DF",
  },
  dangerText: { color: colors.red },
  secondaryButton: {
    backgroundColor: "#DCECE3",
  },
  secondaryText: { color: colors.green },
  safe: { flex: 1, backgroundColor: colors.bg },
  page: {
    padding: 22,
    gap: 18,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brandLogo: { width: 110, maxWidth: '100%', height: 37 },
  cardChevron: { width: 10, height: 10, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: colors.green, transform: [{ rotate: "45deg" }], marginRight: 4 },
  cardTitle: { flex: 1, minWidth: 0 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 14, flexShrink: 0 },
  tagline: { fontSize: 26, fontWeight: "800", color: colors.ink },
  title: { fontSize: 30, fontWeight: "800", color: colors.ink },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  muted: { fontSize: 15, lineHeight: 23, color: colors.muted },
  heading: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.ink,
    flexShrink: 1,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 22,
    gap: 12,
    borderWidth: 1,
    borderColor: "#D8E2DB",
  },
  badge: {
    fontSize: 12,
    color: colors.green,
    fontWeight: "600",
    backgroundColor: colors.pale,
    alignSelf: "flex-start",
    padding: 8,
    borderRadius: 8,
  },
  value: { fontSize: 30, fontWeight: "800", color: colors.ink },
  track: {
    height: 10,
    borderRadius: 8,
    backgroundColor: colors.pale,
    overflow: "hidden",
  },
  warning: { color: "#875000", fontSize: 14, lineHeight: 21 },
  alert: {
    backgroundColor: "#FFF0EB",
    color: colors.red,
    fontSize: 14,
    lineHeight: 21,
    padding: 12,
    borderRadius: 10,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.green,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "700", fontSize: 14 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#D8E2DB",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "white",
  },
  summary: {
    flexDirection: "row",
    padding: 24,
    borderRadius: 22,
    backgroundColor: colors.pale,
    justifyContent: "space-between",
    gap: 16,
  },
  summaryNumber: { fontSize: 38, fontWeight: "800", color: colors.green },
  note: { fontSize: 13, lineHeight: 20, color: colors.muted },
  footer: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    color: colors.muted,
  },
});
