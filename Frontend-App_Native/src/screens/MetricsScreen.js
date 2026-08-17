import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import AppModal from "../components/AppModal";
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
import { isConflict } from "../api/client";

/**
 * Chỉ số sức khỏe tự theo dõi tại nhà.
 * - Đường huyết: tự đo, có thời điểm (trước/sau ăn).
 * - Huyết áp: nhập gộp tâm thu + tâm trương.
 * - HbA1c: KHÔNG nhập tay — chỉ hiển thị giá trị gần nhất do bác sĩ ghi.
 * - Metric có visitId là dữ liệu bác sĩ ghi trong lượt khám: bệnh nhân chỉ xem.
 * Biểu đồ đường huyết 30 ngày; metric tự theo dõi mới được thêm/sửa/xoá.
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
          try {
            await data.metrics.remove(item.id, item.rowVersion, item.pairRowVersion);
            toast.push("Đã ẩn bản ghi.", "success");
            await Promise.all([list.reload(), summary.reload()]);
          } catch (e) {
            if (isConflict(e)) {
              toast.push("Chỉ số vừa được thay đổi ở nơi khác. Đã tải lại dữ liệu mới.", "error");
              await Promise.all([list.reload(), summary.reload()]);
            } else {
              toast.push(e.message, "error");
            }
          }
        },
      },
    ]);
  };

  // Backend trả cấu trúc lồng: { glucose:{average, abnormalCount, chart:[{date,value}]},
  // hba1c:{latest}, bloodPressure:{...} }. Map đúng field để vẽ biểu đồ.
  const glucose = summary.data?.glucose || {};
  const chartPoints = (glucose.chart || []).map((p) => ({
    x: p.date,
    y: Number(p.value),
  }));

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
              <Summary label="Trung bình" value={num(glucose.average)} unit="mmol/L" />
              <Summary label="Bất thường" value={glucose.abnormalCount ?? 0} unit="lần" />
              <Summary label="HbA1c gần nhất" value={num(summary.data?.hba1c?.latest?.value)} unit="%" />
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
                  <Text style={[styles.metricSource, m.visitId && styles.metricSourceVisit]}>
                    {m.visitId ? `Ghi nhận tại lượt khám #${m.visitId}` : "Tự theo dõi tại nhà"}
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
              {m.visitId ? (
                <View style={styles.readOnlyRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />
                  <Text style={styles.readOnlyText}>Chỉ đọc · chỉ số do bác sĩ ghi trong lượt khám</Text>
                </View>
              ) : (
                <View style={styles.metricActions}>
                  <TouchableOpacity onPress={() => setEditing(withBpPair(m))} style={styles.actionBtn}>
                    <Ionicons name="create-outline" size={18} color={colors.muted} />
                    <Text style={styles.actionText}>Sửa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(m)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.alert} />
                    <Text style={[styles.actionText, { color: colors.alert }]}>Xóa</Text>
                  </TouchableOpacity>
                </View>
              )}
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

/**
 * Khi sửa một bản ghi huyết áp (tâm thu hoặc tâm trương), tìm bản ghi cặp cùng
 * thời điểm để form nạp đủ cả hai giá trị (backend yêu cầu gửi đồng thời).
 * Trả về object bản ghi kèm _systolic/_diastolic nếu là huyết áp.
 */
function withBpPair(m) {
  if (m.metricType !== 3 && m.metricType !== 4) return m;
  return {
    ...m,
    _systolic: m.systolicValue != null ? String(m.systolicValue) : "",
    _diastolic: m.diastolicValue != null ? String(m.diastolicValue) : "",
    _updateId: m.metricType === 3 ? m.id : (m.pairMetricId || m.id),
    _rowVersion: m.metricType === 3 ? m.rowVersion : m.pairRowVersion,
    _pairRowVersion: m.metricType === 3 ? m.pairRowVersion : m.rowVersion,
  };
}

function MetricForm({ value, onClose, onSaved }) {
  const data = useData();
  const toast = useToast();
  const isNew = value === "new";

  // Khi sửa bản ghi huyết áp cũ (type 3 hoặc 4), coi như đang ở nhóm "Huyết áp".
  const initialType = isNew ? 1 : value.metricType;
  const isBpType = (t) => t === 3 || t === 4;

  const [type, setType] = useState(isBpType(initialType) ? 3 : initialType);
  const [val, setVal] = useState(isNew ? "" : String(value.value));
  // Hai ô cho huyết áp (tạo mới, hoặc sửa — nạp từ cặp bản ghi).
  const [systolic, setSystolic] = useState(isNew ? "" : value._systolic || "");
  const [diastolic, setDiastolic] = useState(isNew ? "" : value._diastolic || "");
  const [context, setContext] = useState(isNew ? null : value.context ?? null);
  const [note, setNote] = useState(isNew ? "" : value.note || "");
  const [busy, setBusy] = useState(false);

  const isGlucose = type === 1;
  const isBp = type === 3;

  const save = async () => {
    setBusy(true);
    try {
      // HUYẾT ÁP (tạo mới hoặc sửa): luôn gửi metricType=3 + cả systolic + diastolic.
      if (isBp) {
        // Chỉ ép kiểu, không phán xét giá trị. Luật "phải có đủ hai chỉ số" và
        // "tâm thu > tâm trương" thuộc về backend.
        // Chuỗi rỗng phải thành null, vì Number("") = 0 sẽ gửi huyết áp 0 lên
        // server và qua được mọi ràng buộc "có giá trị".
        const s = systolic === "" || systolic == null ? null : Number(systolic);
        const d = diastolic === "" || diastolic == null ? null : Number(diastolic);
        const bpPayload = {
          metricType: 3,
          systolicValue: Number.isNaN(s) ? null : s,
          diastolicValue: Number.isNaN(d) ? null : d,
          note: note || null,
          rowVersion: isNew ? undefined : value._rowVersion,
          pairRowVersion: isNew ? undefined : value._pairRowVersion,
        };
        if (isNew) await data.metrics.create(bpPayload);
        else await data.metrics.update(value._updateId || value.id, bpPayload);
        toast.push("Đã lưu huyết áp.", "success");
        onSaved();
        return;
      }

      // Đường huyết (tạo/sửa).
      // Như trên: chỉ ép kiểu, ngưỡng hợp lệ do backend quyết định.
      const parsed = val === "" || val == null ? null : Number(val);
      const numVal = Number.isNaN(parsed) ? null : parsed;
      const payload = {
        metricType: type,
        value: numVal,
        context: isGlucose ? context : null,
        note: note || null,
        rowVersion: isNew ? undefined : value.rowVersion,
      };
      if (isNew) await data.metrics.create(payload);
      else await data.metrics.update(value.id, payload);
      toast.push("Đã lưu chỉ số.", "success");
      onSaved();
    } catch (e) {
      if (isConflict(e)) {
        toast.push("Chỉ số vừa được thay đổi ở nơi khác. Hãy đóng form, tải lại và thử lại.", "error");
        return;
      }
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal visible animationType="slide" transparent onRequestClose={onClose}>
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

          {isBp ? (
            // Huyết áp: nhập gộp tâm thu + tâm trương (cả khi tạo và sửa).
            <View style={styles.bpRow}>
              <View style={{ flex: 1 }}>
                <Field label="Tâm thu (mmHg)" required>
                  <Input value={systolic} onChangeText={setSystolic} placeholder="VD 120" keyboardType="number-pad" />
                </Field>
              </View>
              <Text style={styles.bpSlash}>/</Text>
              <View style={{ flex: 1 }}>
                <Field label="Tâm trương (mmHg)" required>
                  <Input value={diastolic} onChangeText={setDiastolic} placeholder="VD 80" keyboardType="number-pad" />
                </Field>
              </View>
            </View>
          ) : (
            <Field label={`Giá trị (${metricTypes[type]?.unit || ""})`} required>
              <Input value={val} onChangeText={setVal} placeholder="Nhập số" keyboardType="decimal-pad" />
            </Field>
          )}

          {isGlucose && (
            <Field label="Thời điểm đo">
              <View style={styles.chipWrap}>
                {contextOptions.map((c) => (
                  <FilterChip key={c.value} label={c.label} active={context === c.value} onPress={() => setContext(c.value)} />
                ))}
              </View>
              <Text style={styles.fieldHint}>Lưu ý: Sau ăn thì nên đo sau 2 tiếng</Text>
            </Field>
          )}

          <Field label="Ghi chú">
            <Input value={note} onChangeText={setNote} placeholder="Tùy chọn" multiline />
          </Field>

          <Button title="Lưu" onPress={save} busy={busy} />
        </View>
      </View>
    </AppModal>
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
  bpRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bpSlash: { ...font.h2, color: colors.muted, marginBottom: 14 },
  fieldHint: { ...font.tiny, color: colors.muted, marginTop: spacing.sm, fontStyle: "italic" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...font.small, color: colors.muted, fontWeight: "600" },
  chipTextActive: { color: colors.white },

  metricCard: { padding: spacing.md },
  metricTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  metricType: { ...font.h3, color: colors.ink },
  metricMeta: { ...font.small, color: colors.muted, marginTop: 2 },
  metricSource: { ...font.tiny, color: colors.faint, marginTop: 4 },
  metricSourceVisit: { color: colors.primary },
  metricValue: { ...font.h2, color: colors.ink },
  metricUnit: { ...font.small, color: colors.muted },
  metricNote: { ...font.small, color: colors.muted, marginTop: 8, fontStyle: "italic" },
  metricActions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairline },
  readOnlyRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairline },
  readOnlyText: { ...font.small, color: colors.muted },
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
