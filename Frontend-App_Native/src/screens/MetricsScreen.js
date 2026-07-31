import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, Button, Field, Input, Badge, LoadState, SectionTitle } from "../components/ui";
import { MiniChart } from "../components/MiniChart";
import { colors } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";
import { fmtDate, num } from "../lib/format";
import { metricTypes, metricContexts, metricTypeOptions, contextOptions } from "../lib/enums";

/**
 * Chỉ số sức khỏe: đường huyết, HbA1c, huyết áp.
 * - Biểu đồ đường huyết 30 ngày (tóm tắt).
 * - Danh sách bản ghi, thêm/sửa/xoá (xoá là ẩn mềm phía backend).
 */
export default function MetricsScreen({ route }) {
  const data = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | "new" | bản ghi
  const [filterType, setFilterType] = useState("");

  const summary = useAsync(() => data.metrics.summary(30), []);
  const list = useAsync(() => data.metrics.list({ type: filterType || undefined, size: 50 }), [filterType]);

  // Mở sẵn form nếu điều hướng từ lối tắt trang chủ.
  useEffect(() => {
    if (route?.params?.openCreate) setEditing("new");
  }, [route?.params?.openCreate]);

  const remove = (item) => {
    Alert.alert("Xóa bản ghi", "Ẩn bản ghi này khỏi biểu đồ? Dữ liệu vẫn được lưu để bác sĩ đối chiếu.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa", style: "destructive",
        onPress: async () => {
          try { await data.metrics.remove(item.id); toast.push("Đã ẩn bản ghi.", "success"); list.reload(); summary.reload(); }
          catch (e) { toast.push(e.message, "error"); }
        },
      },
    ]);
  };

  const chartPoints = (summary.data?.byDay || []).map((d) => ({ x: d.date, y: d.avg }));

  const saved = () => { setEditing(null); list.reload(); summary.reload(); };

  return (
    <>
      <Screen>
        {/* Tóm tắt đường huyết */}
        <Card>
          <SectionTitle>Đường huyết 30 ngày</SectionTitle>
          <LoadState loading={summary.loading} error={summary.error} onRetry={summary.reload}>
            <MiniChart points={chartPoints} unit=" mmol/L" />
            <View style={styles.summaryRow}>
              <Summary label="Trung bình" value={num(summary.data?.glucoseAvg)} unit="mmol/L" />
              <Summary label="Bất thường" value={summary.data?.glucoseAbnormalCount ?? 0} unit="lần" />
              <Summary label="HbA1c gần nhất" value={num(summary.data?.latestHbA1c)} unit="%" />
            </View>
          </LoadState>
        </Card>

        {/* Bộ lọc loại */}
        <View style={styles.filterRow}>
          <FilterChip label="Tất cả" active={filterType === ""} onPress={() => setFilterType("")} />
          {metricTypeOptions.map((t) => (
            <FilterChip key={t.value} label={t.label} active={filterType === String(t.value)} onPress={() => setFilterType(String(t.value))} />
          ))}
        </View>

        {/* Danh sách */}
        <LoadState
          loading={list.loading} error={list.error}
          empty={!list.data?.items?.length} emptyText="Chưa có chỉ số nào. Nhấn nút + để thêm."
          onRetry={list.reload}
        >
          {list.data?.items?.map((m) => (
            <Card key={m.id} style={styles.metricCard}>
              <View style={styles.metricTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metricType}>{metricTypes[m.metricType]?.label || "Chỉ số"}</Text>
                  <Text style={styles.metricMeta}>
                    {fmtDate(m.recordedAtUtc, true)}
                    {m.context ? ` · ${metricContexts[m.context]}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.metricValue, m.isAbnormal && { color: colors.alert }]}>
                    {num(m.value)} <Text style={styles.metricUnit}>{m.unit}</Text>
                  </Text>
                  {m.isAbnormal && <Badge text="Bất thường" kind="alert" />}
                </View>
              </View>
              {m.note ? <Text style={styles.metricNote}>{m.note}</Text> : null}
              <View style={styles.metricActions}>
                <TouchableOpacity onPress={() => setEditing(m)} style={styles.actionBtn}>
                  <Ionicons name="create-outline" size={18} color={colors.muted} />
                  <Text style={styles.actionText}>Sửa</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(m)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.alert} />
                  <Text style={[styles.actionText, { color: colors.alert }]}>Xóa</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </LoadState>
      </Screen>

      {/* Nút thêm nổi */}
      <TouchableOpacity style={styles.fab} onPress={() => setEditing("new")} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {editing && <MetricForm value={editing} onClose={() => setEditing(null)} onSaved={saved} />}
    </>
  );
}

function MetricForm({ value, onClose, onSaved }) {
  const data = useData();
  const toast = useToast();
  const isNew = value === "new";
  const [type, setType] = useState(isNew ? 1 : value.metricType);
  const [val, setVal] = useState(isNew ? "" : String(value.value));
  const [context, setContext] = useState(isNew ? null : value.context ?? null);
  const [note, setNote] = useState(isNew ? "" : value.note || "");
  const [busy, setBusy] = useState(false);

  const isGlucose = type === 1;

  const save = async () => {
    const numVal = Number(val);
    if (!val || isNaN(numVal)) { toast.push("Nhập giá trị hợp lệ.", "error"); return; }
    setBusy(true);
    try {
      if (isNew) {
        await data.metrics.create({ metricType: type, value: numVal, context: isGlucose ? context : null, note: note || null });
      } else {
        await data.metrics.update(value.id, { metricType: type, value: numVal, context: isGlucose ? context : null, note: note || null });
      }
      toast.push("Đã lưu chỉ số.", "success");
      onSaved();
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{isNew ? "Ghi chỉ số mới" : "Sửa chỉ số"}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.muted} /></TouchableOpacity>
          </View>

          <Field label="Loại chỉ số" required>
            <View style={styles.chipWrap}>
              {metricTypeOptions.map((t) => (
                <FilterChip key={t.value} label={t.label} active={type === t.value} onPress={() => setType(t.value)} disabled={!isNew} />
              ))}
            </View>
          </Field>

          <Field label={`Giá trị (${metricTypes[type]?.unit || ""})`} required>
            <Input value={val} onChangeText={setVal} placeholder="Nhập số" keyboardType="decimal-pad" />
          </Field>

          {isGlucose && (
            <Field label="Thời điểm đo">
              <View style={styles.chipWrap}>
                <FilterChip label="—" active={context === null} onPress={() => setContext(null)} />
                {contextOptions.map((c) => (
                  <FilterChip key={c.value} label={c.label} active={context === c.value} onPress={() => setContext(c.value)} />
                ))}
              </View>
            </Field>
          )}

          <Field label="Ghi chú">
            <Input value={note} onChangeText={setNote} placeholder="Tùy chọn" multiline />
          </Field>

          <Button title="Lưu" onPress={save} busy={busy} />
        </View>
      </View>
    </Modal>
  );
}

function Summary({ label, value, unit }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryUnit}>{unit}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, active && styles.chipActive, disabled && { opacity: 0.4 }]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.hairline },
  summaryItem: { alignItems: "center" },
  summaryValue: { ...font.h2, color: colors.ink },
  summaryUnit: { ...font.tiny, color: colors.faint },
  summaryLabel: { ...font.small, color: colors.muted, marginTop: 2 },

  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...font.small, color: colors.muted, fontWeight: "600" },
  chipTextActive: { color: colors.white },

  metricCard: { padding: spacing.md },
  metricTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  metricType: { ...font.h3, color: colors.ink },
  metricMeta: { ...font.small, color: colors.muted, marginTop: 2 },
  metricValue: { ...font.h2, color: colors.ink },
  metricUnit: { ...font.small, color: colors.muted },
  metricNote: { ...font.small, color: colors.muted, marginTop: 8, fontStyle: "italic" },
  metricActions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairline },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { ...font.small, color: colors.muted, fontWeight: "600" },

  fab: {
    position: "absolute", right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  modalTitle: { ...font.h2, color: colors.ink },
});
