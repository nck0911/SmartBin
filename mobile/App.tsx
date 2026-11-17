import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Bin, Reading, status, validateBin } from "./src/model";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMonitorContext } from "./src/MonitorContext";
import { BinHeightSettings } from "./src/BinHeightSettings";
import { NotificationSettings } from "./src/NotificationSettings";
import { BinQrScanner } from "./src/components/BinQrScanner";
import { ConfirmationDialog } from "./src/components/ConfirmationDialog";
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
}: {
  title: string;
  onPress: () => void;
  danger?: boolean;
  secondary?: boolean;
  fill?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        fill && s.actionButton,
        secondary && s.secondaryButton,
        danger && s.dangerButton,
        { opacity: pressed ? 0.6 : 1 },
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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        style={s.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
function Metrics({ reading }: { reading?: Reading }) {
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
      {d && !d.configured && (
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
  const [editing, setEditing] = useState<string>();
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(false);
  const [url, setUrl] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Bin>();
  const [scanning, setScanning] = useState(false);
  function scanned(b: Bin) {
    setScanning(false);
    const existing = m.bins.find((x) => x.id === b.id);
    if (existing) {
      if (existing.topic === b.topic && b.heightCm !== undefined) {
        m.setBins(old => old.map(x => x.id === b.id ? { ...x, heightCm: b.heightCm } : x));
      }
      openBin(existing.id);
      return;
    }
    setEditing(undefined);
    setForm(b);
    setError("");
  }
  const bin = m.bins.find((b) => b.id === selected);
  const alerts = m.bins.filter(
    (b) =>
      (m.readings[b.id]?.data?.configured && m.readings[b.id]?.data?.full) ||
      m.readings[b.id]?.data?.gas_high,
  );
  const visible = m.bins.filter(
    (b) =>
      `${b.name} ${b.location}`.toLowerCase().includes(query.toLowerCase()) &&
      (!filter || alerts.includes(b)),
  );
  function edit(b?: Bin) {
    setEditing(b?.id);
    setForm(b ? { ...b } : { id: "", name: "", location: "", topic: "" });
    setError("");
  }
  function save() {
    if (!form) return;
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
            <Text style={s.eyebrow}>SMARTBIN</Text>
            <Text style={s.title}>Không gian sạch</Text>
          </>
        )}
        {m.demo && <Text style={s.badge}>DEMO · Dữ liệu minh họa</Text>}
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
              <Metrics reading={m.readings[bin.id]} />
            </View>
            <BinHeightSettings
              key={bin.id}
              bin={bin}
              reading={m.readings[bin.id]}
              demo={m.demo}
              connected={m.connected}
              now={m.now}
              saveHeight={m.saveHeight}
            />
            <View style={s.card}>
              <Text style={s.heading}>Thông tin thiết bị</Text>
              <Text style={s.muted}>
                Chiều cao trên thiết bị: {m.readings[bin.id]?.data?.bin_height_cm != null ? `${m.readings[bin.id].data!.bin_height_cm} cm` : 'Chưa xác nhận'}
              </Text>
              {bin.heightCm !== undefined && <Text style={s.muted}>Chiều cao từ QR: {bin.heightCm} cm</Text>}
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
                Lệnh nắp:{" "}
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
              <Button title="Quét QR" onPress={() => setScanning(true)} />
            </View>
            <Button
              title="Nhập thông tin thủ công"
              secondary
              onPress={() => edit()}
            />
            <TextInput
              accessibilityLabel="Tìm thùng theo tên hoặc vị trí"
              placeholder="Tìm theo tên hoặc vị trí…"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={s.input}
            />
            <View style={s.row}>
              <Text style={s.label}>Chỉ hiện thùng có cảnh báo</Text>
              <Switch
                accessibilityLabel="Chỉ hiện thùng có cảnh báo"
                value={filter}
                onValueChange={setFilter}
              />
            </View>
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
                  <Text style={s.heading}>{b.name}</Text>
                  <Text style={s.link}>Xem →</Text>
                </View>
                <Text style={s.muted}>{b.location}</Text>
                <Text style={s.badge}>
                  {status(m.readings[b.id], m.connected, m.now)}
                </Text>
                <Metrics reading={m.readings[b.id]} />
              </Pressable>
            ))}
            {!visible.length && (
              <View style={s.card}>
                <Text style={s.heading}>
                  {m.bins.length
                    ? "Chưa có thùng phù hợp"
                    : "Thêm thùng đầu tiên"}
                </Text>
                <Text style={s.muted}>
                  Quét QR để thêm thùng hoặc thay đổi bộ lọc.
                </Text>
              </View>
            )}
            <View style={s.card}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Chế độ minh họa</Text>
                  <Text style={s.note}>
                    Dùng dữ liệu mẫu để trải nghiệm ứng dụng.
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Chế độ minh họa"
                  value={m.demo}
                  onValueChange={m.setDemo}
                />
              </View>
              {m.demo && (
                <Button
                  title="Thêm thùng demo có cảnh báo"
                  onPress={() => {
                    const id = `demo-${Date.now()}`;
                    m.setBins((old) => [
                      ...old,
                      {
                        id,
                        name: "Thùng minh họa",
                        location: "Khu vực demo",
                        topic: `demo/${id}`,
                      },
                    ]);
                  }}
                />
              )}
              <Button
                title="Cấu hình kết nối"
                onPress={() => {
                  setUrl(m.broker);
                  setError("");
                  setSettings(true);
                }}
              />
            </View>
          </>
        )}
        <NotificationSettings state={notifications} />
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
        visible={!!form || settings}
        animationType="slide"
        onRequestClose={() => {
          setForm(undefined);
          setSettings(false);
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
              <Text style={s.title}>
                {settings
                  ? "Kết nối dịch vụ"
                  : editing
                    ? "Sửa thùng rác"
                    : "Thêm thùng rác"}
              </Text>
              <Text style={s.muted}>
                {settings
                  ? "Sử dụng địa chỉ kết nối được cung cấp khi thiết lập hệ thống."
                  : editing
                    ? "Đặt tên và vị trí để dễ nhận biết thùng."
                    : "Mã thiết bị và đường dẫn dữ liệu cần khớp cấu hình của thùng."}
              </Text>
              {settings ? (
                <Field
                  label="Địa chỉ kết nối"
                  value={url}
                  onChangeText={setUrl}
                />
              ) : (
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
                    onChangeText={(v) => setForm({ ...form, [key]: v })}
                  />
                ))
              )}
              {!settings && form?.heightCm !== undefined && (
                <Text style={s.note}>Chiều cao từ QR: {form.heightCm} cm. Sau khi thêm thùng, mở chi tiết và xác nhận thiết lập trên thiết bị.</Text>
              )}
              {!!error && (
                <Text accessibilityRole="alert" style={s.alert}>
                  {error}
                </Text>
              )}
              <View style={s.actions}>
                <Button
                  title="Lưu thay đổi"
                  fill
                  onPress={() => {
                    if (!settings) return save();
                    try {
                      const parsed = new URL(url.trim());
                      if (
                        parsed.protocol !== "wss:" ||
                        !parsed.hostname ||
                        parsed.username ||
                        parsed.password ||
                        parsed.hash
                      )
                        throw Error();
                      m.setBroker(url.trim());
                      setSettings(false);
                    } catch {
                      setError(
                        "Địa chỉ kết nối phải bắt đầu bằng wss:// và không kèm thông tin đăng nhập.",
                      );
                    }
                  }}
                />
                <Button
                  title="Hủy"
                  secondary
                  fill
                  onPress={() => {
                    setForm(undefined);
                    setSettings(false);
                  }}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  actions: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  actionButton: { flex: 1, minWidth: 0, minHeight: 48 },
  dangerButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.red,
  },
  dangerText: { color: colors.red },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.green,
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
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: colors.green,
  },
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
  link: { fontSize: 14, color: colors.green, fontWeight: "600" },
  note: { fontSize: 13, lineHeight: 20, color: colors.muted },
  footer: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    color: colors.muted,
  },
});
